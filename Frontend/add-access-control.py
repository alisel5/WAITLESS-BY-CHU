#!/usr/bin/env python3
"""
Script to add access control to all HTML files in the Frontend directory
"""

import os
import re

def add_access_control_to_html_files():
    """Add access control scripts to all HTML files"""
    
    # Directories to process (excluding shared and Acceuil which we already handled)
    directories = [
        'dashboard',
        'staff', 
        'services',
        'patients',
        'qr-display',
        'reports',
        'secretary',
        'qr code',
        'tickets',
        'chatbot',
        'signup'
    ]
    
    # Scripts to add
    access_control_scripts = [
        '  <script src="../shared/permissions.js"></script>',
        '  <script src="../shared/access-control.js"></script>'
    ]
    
    for directory in directories:
        dir_path = directory  # We're already in the Frontend directory
        if not os.path.exists(dir_path):
            print(f"Directory {dir_path} does not exist, skipping...")
            continue
            
        for filename in os.listdir(dir_path):
            if filename.endswith('.html'):
                file_path = os.path.join(dir_path, filename)
                print(f"Processing: {file_path}")
                
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    # Check if access control scripts are already present
                    if 'permissions.js' in content:
                        print(f"  Access control already present in {filename}")
                        continue
                    
                    # Find the last script tag before closing body
                    script_pattern = r'(\s*<script[^>]*>.*?</script>\s*)'
                    body_pattern = r'(</body>)'
                    
                    # Look for existing script tags
                    script_matches = list(re.finditer(script_pattern, content, re.DOTALL))
                    
                    if script_matches:
                        # Insert after the last script tag
                        last_script = script_matches[-1]
                        insert_pos = last_script.end()
                        
                        # Prepare the scripts to insert
                        scripts_to_insert = '\n'.join(access_control_scripts) + '\n'
                        
                        # Insert the scripts
                        new_content = (
                            content[:insert_pos] + 
                            '\n' + scripts_to_insert + 
                            content[insert_pos:]
                        )
                    else:
                        # No script tags found, insert before closing body
                        body_match = re.search(body_pattern, content)
                        if body_match:
                            insert_pos = body_match.start()
                            scripts_to_insert = '\n'.join(access_control_scripts) + '\n  '
                            new_content = (
                                content[:insert_pos] + 
                                scripts_to_insert + 
                                content[insert_pos:]
                            )
                        else:
                            print(f"  Could not find </body> tag in {filename}")
                            continue
                    
                    # Write the updated content
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    
                    print(f"  ✓ Added access control to {filename}")
                    
                except Exception as e:
                    print(f"  ✗ Error processing {filename}: {e}")

if __name__ == "__main__":
    print("Adding access control to HTML files...")
    add_access_control_to_html_files()
    print("Done!") 