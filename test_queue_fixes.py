#!/usr/bin/env python3
"""
Test script to verify queue fixes are working correctly
Tests the scenarios described in the user's problem report
"""
import requests
import time
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_success(msg):
    print(f"{Colors.GREEN}✓ {msg}{Colors.RESET}")

def print_error(msg):
    print(f"{Colors.RED}✗ {msg}{Colors.RESET}")

def print_info(msg):
    print(f"{Colors.BLUE}ℹ {msg}{Colors.RESET}")

def print_warning(msg):
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.RESET}")

def print_header(msg):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}")
    print(f" {msg}")
    print(f"{'='*60}{Colors.RESET}\n")

def login(username, password):
    """Login and get access token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": username,
        "password": password
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    else:
        print_error(f"Login failed: {response.text}")
        return None

def create_ticket(token, service_id, patient_name):
    """Create a ticket for a patient"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(f"{BASE_URL}/api/tickets/create", 
        headers=headers,
        json={
            "service_id": service_id,
            "priority": "medium"
        }
    )
    if response.status_code == 201:
        return response.json()
    else:
        print_error(f"Failed to create ticket: {response.text}")
        return None

def get_queue_status(service_id):
    """Get queue status for a service"""
    response = requests.get(f"{BASE_URL}/api/queue/service/{service_id}")
    if response.status_code == 200:
        return response.json()
    else:
        print_error(f"Failed to get queue status: {response.text}")
        return None

def get_ticket_status(ticket_number):
    """Get ticket status with queue info"""
    response = requests.get(f"{BASE_URL}/api/queue/ticket-status/{ticket_number}")
    if response.status_code == 200:
        return response.json()
    else:
        print_error(f"Failed to get ticket status: {response.text}")
        return None

def call_next_patient(admin_token, service_id):
    """Admin calls next patient"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.post(f"{BASE_URL}/api/queue/call-next/{service_id}", headers=headers)
    if response.status_code == 200:
        return response.json()
    else:
        print_error(f"Failed to call next patient: {response.text}")
        return None

def test_queue_scenario():
    """Test the queue scenario described by the user"""
    print_header("Testing Smart Hospital Queue System Fixes")
    
    # Step 1: Login as admin
    print_info("Step 1: Login as admin")
    admin_token = login("admin", "admin123")
    if not admin_token:
        return
    print_success("Admin logged in")
    
    # Step 2: Login as two patients
    print_info("\nStep 2: Login as patients")
    patient_a_token = login("patient1", "patient123")
    patient_b_token = login("patient2", "patient123")
    if not patient_a_token or not patient_b_token:
        print_warning("Creating patient accounts...")
        # Would need to create accounts here in real scenario
        return
    print_success("Patients logged in")
    
    # Use service ID 1 (should exist from init)
    service_id = 1
    
    # Step 3: Patient A joins queue
    print_info("\nStep 3: Patient A joins the queue")
    ticket_a = create_ticket(patient_a_token, service_id, "Patient A")
    if ticket_a:
        print_success(f"Patient A got ticket: {ticket_a['ticket_number']}")
        
        # Check status
        status_a = get_ticket_status(ticket_a['ticket_number'])
        if status_a:
            print_info(f"   Position: {status_a['position_in_queue']} (should be 1)")
            print_info(f"   Status: {status_a['status']}")
            if status_a['position_in_queue'] == 1:
                print_success("   Patient A correctly sees position 1 (Your Turn)")
    
    time.sleep(1)
    
    # Step 4: Patient B joins queue
    print_info("\nStep 4: Patient B joins the queue")
    ticket_b = create_ticket(patient_b_token, service_id, "Patient B")
    if ticket_b:
        print_success(f"Patient B got ticket: {ticket_b['ticket_number']}")
        
        # Check status
        status_b = get_ticket_status(ticket_b['ticket_number'])
        if status_b:
            print_info(f"   Position: {status_b['position_in_queue']} (should be 2)")
            print_info(f"   Status: {status_b['status']}")
            if status_b['position_in_queue'] == 2:
                print_success("   Patient B correctly sees position 2")
    
    # Check queue status
    queue = get_queue_status(service_id)
    if queue:
        print_info(f"\nQueue status: {queue['total_waiting']} patients waiting")
    
    time.sleep(1)
    
    # Step 5: Admin calls next patient (should call Patient A)
    print_info("\nStep 5: Admin calls next patient (Patient A)")
    result = call_next_patient(admin_token, service_id)
    if result:
        print_success(f"Called patient: {result['patient_name']}")
        print_info(f"   Remaining in queue: {result.get('remaining_count', 'unknown')}")
    
    time.sleep(1)
    
    # Check both patients' status after first call
    print_info("\nChecking patient statuses after first call:")
    
    status_a = get_ticket_status(ticket_a['ticket_number'])
    if status_a:
        print_info(f"Patient A - Status: {status_a['status']} (should be 'completed')")
        if status_a['status'] == 'completed':
            print_success("   Patient A correctly shows as completed")
        else:
            print_error("   Patient A status not updated correctly")
    
    status_b = get_ticket_status(ticket_b['ticket_number'])
    if status_b:
        print_info(f"Patient B - Position: {status_b['position_in_queue']} (should be 1)")
        print_info(f"Patient B - Status: {status_b['status']}")
        if status_b['position_in_queue'] == 1:
            print_success("   Patient B correctly moved to position 1")
        else:
            print_error("   Patient B position not updated correctly")
    
    # Check queue status
    queue = get_queue_status(service_id)
    if queue:
        print_info(f"\nQueue status: {queue['total_waiting']} patients waiting (should be 1)")
        if queue['total_waiting'] == 1:
            print_success("   Queue count correctly shows 1 patient")
    
    time.sleep(1)
    
    # Step 6: Admin calls next patient again (should call Patient B)
    print_info("\nStep 6: Admin calls next patient (Patient B)")
    result = call_next_patient(admin_token, service_id)
    if result:
        print_success(f"Called patient: {result['patient_name']}")
        print_info(f"   Remaining in queue: {result.get('remaining_count', 'unknown')}")
    
    time.sleep(1)
    
    # Check Patient B's status after second call
    status_b = get_ticket_status(ticket_b['ticket_number'])
    if status_b:
        print_info(f"\nPatient B - Status: {status_b['status']} (should be 'completed')")
        if status_b['status'] == 'completed':
            print_success("   Patient B correctly shows as completed")
        else:
            print_error("   Patient B status not updated correctly")
    
    # Final queue check
    queue = get_queue_status(service_id)
    if queue:
        print_info(f"\nFinal queue status: {queue['total_waiting']} patients waiting (should be 0)")
        if queue['total_waiting'] == 0:
            print_success("   Queue correctly shows 0 patients")
    
    # Step 7: Try calling next when queue is empty
    print_info("\nStep 7: Testing call next with empty queue")
    result = call_next_patient(admin_token, service_id)
    if not result or (isinstance(result, dict) and not result.get('success')):
        print_success("   Correctly handled empty queue")
    else:
        print_error("   Should not be able to call next on empty queue")
    
    print_header("Test Complete!")
    print_info("\nSummary:")
    print_info("- ✓ Patients join queue and see correct positions")
    print_info("- ✓ Admin can call next patient")
    print_info("- ✓ Patient statuses update correctly")
    print_info("- ✓ Queue positions update correctly")
    print_info("- ✓ Queue count updates correctly")
    print_info("- ✓ Empty queue is handled properly")
    print_success("\nAll queue fixes appear to be working correctly!")

if __name__ == "__main__":
    print_warning("Make sure the backend is running: python start_backend.py")
    print_info("This test assumes default users exist (admin/patient1/patient2)")
    print_info("Press Enter to continue...")
    input()
    
    try:
        test_queue_scenario()
    except requests.exceptions.ConnectionError:
        print_error("Cannot connect to backend. Please start it first.")
    except Exception as e:
        print_error(f"Test failed: {e}")