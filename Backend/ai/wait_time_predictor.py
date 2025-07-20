"""
Intelligent Wait Time Prediction Engine
Uses machine learning to predict accurate wait times based on multiple factors
"""

import numpy as np
import pandas as pd
import pickle
import os
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Tuple
from sqlalchemy.orm import Session

# ML imports
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.preprocessing import StandardScaler

# Import our data collector
from .data_collector import AIDataCollector
from models import ServicePriority, Ticket, Service, TicketStatus

class WaitTimePredictorAI:
    """
    Intelligent Wait Time Prediction Engine
    
    Features:
    - Multi-model ensemble for better accuracy
    - Real-time context awareness
    - Fallback to rule-based predictions
    - Automatic model retraining
    """
    
    def __init__(self, model_dir: str = "ai_models"):
        self.model_dir = model_dir
        self.logger = logging.getLogger(__name__)
        
        # Ensure model directory exists
        os.makedirs(model_dir, exist_ok=True)
        
        # Initialize models
        self.models = {
            'random_forest': RandomForestRegressor(
                n_estimators=100,
                max_depth=10,
                random_state=42,
                n_jobs=-1
            ),
            'gradient_boost': GradientBoostingRegressor(
                n_estimators=100,
                max_depth=6,
                random_state=42
            ),
            'linear': LinearRegression()
        }
        
        self.scaler = StandardScaler()
        self.feature_columns = []
        self.is_trained = False
        self.model_metadata = {}
        
        # Data collector
        self.data_collector = AIDataCollector()
        
        # Try to load existing models
        self.load_models()
    
    def train_models(self, db: Session, force_retrain: bool = False) -> Dict:
        """
        Train the prediction models using historical data
        
        Args:
            db: Database session
            force_retrain: Force retraining even if models exist
            
        Returns:
            Dictionary with training results and metrics
        """
        
        if self.is_trained and not force_retrain:
            self.logger.info("Models already trained. Use force_retrain=True to retrain.")
            return self.model_metadata
        
        try:
            self.logger.info("Starting AI model training...")
            
            # Collect training data
            historical_data = self.data_collector.collect_training_data(db, days_back=60)
            
            # If insufficient historical data, generate synthetic data
            if len(historical_data) < 100:
                self.logger.warning("Insufficient historical data. Generating synthetic data...")
                synthetic_data = self.data_collector.generate_synthetic_data(db, num_samples=1000)
                
                if len(historical_data) > 0:
                    # Combine historical and synthetic data
                    training_data = pd.concat([historical_data, synthetic_data], ignore_index=True)
                else:
                    training_data = synthetic_data
            else:
                training_data = historical_data
            
            if training_data.empty:
                raise ValueError("No training data available")
            
            # Prepare features and target
            feature_columns = [
                'service_id', 'hour_of_day', 'day_of_week', 'is_weekend', 'is_peak_hour',
                'priority_score', 'queue_position', 'service_avg_time', 
                'concurrent_patients', 'recent_load'
            ]
            
            X = training_data[feature_columns]
            y = training_data['actual_wait_time']
            
            # Handle missing values
            X = X.fillna(X.mean())
            y = y.fillna(y.mean())
            
            # Store feature columns for later use
            self.feature_columns = feature_columns
            
            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )
            
            # Scale features
            X_train_scaled = self.scaler.fit_transform(X_train)
            X_test_scaled = self.scaler.transform(X_test)
            
            # Train models
            results = {}
            model_scores = {}
            
            for name, model in self.models.items():
                self.logger.info(f"Training {name} model...")
                
                if name == 'linear':
                    # Use scaled features for linear regression
                    model.fit(X_train_scaled, y_train)
                    y_pred = model.predict(X_test_scaled)
                else:
                    # Tree-based models can handle unscaled features
                    model.fit(X_train, y_train)
                    y_pred = model.predict(X_test)
                
                # Calculate metrics
                mae = mean_absolute_error(y_test, y_pred)
                r2 = r2_score(y_test, y_pred)
                
                results[name] = {
                    'mae': mae,
                    'r2': r2,
                    'accuracy_percentage': max(0, (1 - mae / y_test.mean()) * 100)
                }
                
                model_scores[name] = r2  # Use R² for model selection
                
                self.logger.info(f"{name}: MAE={mae:.2f}min, R²={r2:.3f}, Accuracy={results[name]['accuracy_percentage']:.1f}%")
            
            # Select best model
            best_model_name = max(model_scores, key=model_scores.get)
            self.best_model = best_model_name
            
            # Update metadata
            self.model_metadata = {
                'training_date': datetime.now().isoformat(),
                'training_samples': len(training_data),
                'historical_samples': len(historical_data),
                'feature_columns': feature_columns,
                'model_results': results,
                'best_model': best_model_name,
                'best_score': model_scores[best_model_name]
            }
            
            self.is_trained = True
            
            # Save models
            self.save_models()
            
            self.logger.info(f"Training completed! Best model: {best_model_name} (R²={model_scores[best_model_name]:.3f})")
            
            return self.model_metadata
            
        except Exception as e:
            self.logger.error(f"Error during model training: {e}")
            raise
    
    def predict_wait_time(self, service_id: int, priority: ServicePriority, 
                         position: int, db: Session) -> Tuple[int, Dict]:
        """
        Predict wait time using AI models
        
        Args:
            service_id: Service ID
            priority: Patient priority
            position: Position in queue
            db: Database session
            
        Returns:
            Tuple of (predicted_wait_time_minutes, prediction_metadata)
        """
        
        try:
            # Get current context features
            features = self.data_collector.get_current_context_features(
                service_id, priority, position, db
            )
            
            # If models are not trained, use fallback
            if not self.is_trained:
                self.logger.warning("AI models not trained, using fallback prediction")
                return self._fallback_prediction(service_id, priority, position, db)
            
            # Prepare features for prediction
            feature_df = pd.DataFrame([features])
            feature_df = feature_df[self.feature_columns]
            feature_df = feature_df.fillna(feature_df.mean())
            
            # Get predictions from all models
            predictions = {}
            
            for name, model in self.models.items():
                try:
                    if name == 'linear':
                        # Use scaled features for linear regression
                        X_scaled = self.scaler.transform(feature_df)
                        pred = model.predict(X_scaled)[0]
                    else:
                        pred = model.predict(feature_df)[0]
                    
                    predictions[name] = max(1, int(pred))  # Ensure positive prediction
                    
                except Exception as e:
                    self.logger.warning(f"Error with {name} model: {e}")
                    continue
            
            if not predictions:
                # All models failed, use fallback
                return self._fallback_prediction(service_id, priority, position, db)
            
            # Ensemble prediction (weighted average)
            if len(predictions) > 1:
                # Weight by model performance (if available)
                weights = {
                    'random_forest': 0.4,
                    'gradient_boost': 0.4,
                    'linear': 0.2
                }
                
                weighted_sum = sum(pred * weights.get(name, 0.33) for name, pred in predictions.items())
                final_prediction = int(weighted_sum)
            else:
                final_prediction = list(predictions.values())[0]
            
            # Apply business rules and constraints
            final_prediction = self._apply_business_rules(final_prediction, service_id, priority, position, db)
            
            # Prepare metadata
            metadata = {
                'prediction_type': 'ai_ensemble',
                'model_predictions': predictions,
                'final_prediction': final_prediction,
                'confidence': self._calculate_confidence(predictions),
                'features_used': features,
                'best_model_used': self.best_model if hasattr(self, 'best_model') else 'ensemble'
            }
            
            return final_prediction, metadata
            
        except Exception as e:
            self.logger.error(f"Error in AI prediction: {e}")
            return self._fallback_prediction(service_id, priority, position, db)
    
    def _fallback_prediction(self, service_id: int, priority: ServicePriority, 
                           position: int, db: Session) -> Tuple[int, Dict]:
        """
        Fallback prediction using rule-based approach
        """
        
        # Get service average time
        service = db.query(Service).filter(Service.id == service_id).first()
        base_time = service.avg_wait_time if service else 15
        
        # Apply position multiplier
        position_time = (position - 1) * base_time
        
        # Apply priority modifier
        priority_modifiers = {
            ServicePriority.HIGH: 0.7,
            ServicePriority.MEDIUM: 1.0,
            ServicePriority.LOW: 1.2
        }
        priority_modifier = priority_modifiers.get(priority, 1.0)
        
        # Apply time-of-day modifier
        current_hour = datetime.now().hour
        time_modifier = 1.3 if current_hour in [9, 10, 11, 14, 15, 16] else 1.0
        
        # Calculate final prediction
        prediction = int((base_time + position_time) * priority_modifier * time_modifier)
        prediction = max(5, min(prediction, 180))  # Between 5 minutes and 3 hours
        
        metadata = {
            'prediction_type': 'rule_based_fallback',
            'base_time': base_time,
            'position_effect': position_time,
            'priority_modifier': priority_modifier,
            'time_modifier': time_modifier,
            'final_prediction': prediction
        }
        
        return prediction, metadata
    
    def _apply_business_rules(self, prediction: int, service_id: int, 
                            priority: ServicePriority, position: int, db: Session) -> int:
        """Apply business rules to AI predictions"""
        
        # Minimum wait time
        if prediction < 1:
            prediction = 1
        
        # Maximum wait time (3 hours)
        if prediction > 180:
            prediction = 180
        
        # Priority adjustments
        if priority == ServicePriority.HIGH and prediction > 60:
            prediction = min(60, prediction)  # High priority max 1 hour
        
        # Position 1 should have very low wait time
        if position == 1:
            prediction = min(prediction, 10)
        
        return prediction
    
    def _calculate_confidence(self, predictions: Dict) -> float:
        """Calculate prediction confidence based on model agreement"""
        
        if len(predictions) < 2:
            return 0.7  # Medium confidence for single model
        
        values = list(predictions.values())
        mean_pred = np.mean(values)
        std_pred = np.std(values)
        
        # Higher confidence when models agree (low std deviation)
        relative_std = std_pred / mean_pred if mean_pred > 0 else 1
        confidence = max(0.3, 1.0 - relative_std)
        
        return round(confidence, 2)
    
    def save_models(self):
        """Save trained models to disk"""
        
        try:
            # Save models
            for name, model in self.models.items():
                model_path = os.path.join(self.model_dir, f"{name}_model.pkl")
                with open(model_path, 'wb') as f:
                    pickle.dump(model, f)
            
            # Save scaler
            scaler_path = os.path.join(self.model_dir, "scaler.pkl")
            with open(scaler_path, 'wb') as f:
                pickle.dump(self.scaler, f)
            
            # Save metadata
            metadata_path = os.path.join(self.model_dir, "metadata.pkl")
            with open(metadata_path, 'wb') as f:
                pickle.dump({
                    'feature_columns': self.feature_columns,
                    'is_trained': self.is_trained,
                    'model_metadata': self.model_metadata
                }, f)
            
            self.logger.info("Models saved successfully")
            
        except Exception as e:
            self.logger.error(f"Error saving models: {e}")
    
    def load_models(self):
        """Load trained models from disk"""
        
        try:
            # Load metadata first
            metadata_path = os.path.join(self.model_dir, "metadata.pkl")
            if os.path.exists(metadata_path):
                with open(metadata_path, 'rb') as f:
                    metadata = pickle.load(f)
                    self.feature_columns = metadata.get('feature_columns', [])
                    self.is_trained = metadata.get('is_trained', False)
                    self.model_metadata = metadata.get('model_metadata', {})
            
            # Load models
            for name in self.models.keys():
                model_path = os.path.join(self.model_dir, f"{name}_model.pkl")
                if os.path.exists(model_path):
                    with open(model_path, 'rb') as f:
                        self.models[name] = pickle.load(f)
            
            # Load scaler
            scaler_path = os.path.join(self.model_dir, "scaler.pkl")
            if os.path.exists(scaler_path):
                with open(scaler_path, 'rb') as f:
                    self.scaler = pickle.load(f)
            
            if self.is_trained:
                self.logger.info("Pre-trained models loaded successfully")
            
        except Exception as e:
            self.logger.warning(f"Could not load existing models: {e}")
            self.is_trained = False
    
    def get_model_info(self) -> Dict:
        """Get information about the current models"""
        
        return {
            'is_trained': self.is_trained,
            'model_metadata': self.model_metadata,
            'feature_columns': self.feature_columns,
            'available_models': list(self.models.keys()),
            'model_dir': self.model_dir
        }
    
    def needs_retraining(self, days_threshold: int = 7) -> bool:
        """Check if models need retraining based on age"""
        
        if not self.is_trained:
            return True
        
        if 'training_date' not in self.model_metadata:
            return True
        
        try:
            training_date = datetime.fromisoformat(self.model_metadata['training_date'])
            days_since_training = (datetime.now() - training_date).days
            
            return days_since_training > days_threshold
            
        except:
            return True

# Global instance for easy access
ai_predictor = WaitTimePredictorAI()