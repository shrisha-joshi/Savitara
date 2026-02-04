#!/usr/bin/env python3
"""
Deployment Readiness Checker for Savitara Platform
Validates that the project is ready for production deployment
"""

import os
import sys
import json
from pathlib import Path

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_header(text):
    print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BLUE}{text:^60}{Colors.END}")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}\n")

def check_mark(passed):
    return f"{Colors.GREEN}✓{Colors.END}" if passed else f"{Colors.RED}✗{Colors.END}"

def check_file_exists(file_path, description):
    exists = os.path.exists(file_path)
    print(f"{check_mark(exists)} {description}")
    return exists

def check_env_variable(env_content, var_name, should_not_contain=None):
    if var_name not in env_content:
        print(f"{check_mark(False)} {var_name} is missing")
        return False
    
    value = [line.split('=', 1)[1].strip() for line in env_content.split('\n') 
             if line.startswith(var_name + '=')]
    
    if not value:
        print(f"{check_mark(False)} {var_name} has no value")
        return False
    
    value = value[0]
    
    if should_not_contain and should_not_contain in value:
        print(f"{check_mark(False)} {var_name} contains placeholder value")
        return False
    
    print(f"{check_mark(True)} {var_name} is configured")
    return True

def main():
    print_header("Savitara Deployment Readiness Check")
    
    all_checks_passed = True
    
    # Check 1: Backend Files
    print_header("1. Backend Files")
    checks = [
        check_file_exists("backend/requirements.txt", "requirements.txt exists"),
        check_file_exists("backend/app/main.py", "main.py exists"),
        check_file_exists("backend/.env.example", ".env.example exists"),
        check_file_exists("backend/railway.json", "railway.json exists"),
        check_file_exists("backend/Dockerfile", "Dockerfile exists"),
    ]
    all_checks_passed &= all(checks)
    
    # Check 2: GitHub Actions
    print_header("2. GitHub Actions CI/CD")
    checks = [
        check_file_exists(".github/workflows/deploy.yml", "deploy.yml exists"),
    ]
    
    if checks[0]:
        with open(".github/workflows/deploy.yml", "r") as f:
            workflow_content = f.read()
            
        # Check for updated actions versions
        has_v4_checkout = "actions/checkout@v4" in workflow_content
        has_v4_upload = "actions/upload-artifact@v4" in workflow_content
        slack_optional = "secrets.SLACK_WEBHOOK" in workflow_content and "if:" in workflow_content
        
        print(f"{check_mark(has_v4_checkout)} Using latest checkout action (v4)")
        print(f"{check_mark(has_v4_upload)} Using latest upload-artifact action (v4)")
        print(f"{check_mark(slack_optional)} Slack webhook is optional")
        
        checks.extend([has_v4_checkout, has_v4_upload, slack_optional])
    
    all_checks_passed &= all(checks)
    
    # Check 3: Mobile App Configuration
    print_header("3. Mobile App Configuration")
    checks = []
    
    if os.path.exists("savitara-app/package.json"):
        with open("savitara-app/package.json", "r") as f:
            package_json = json.load(f)
        
        has_test_script = "test" in package_json.get("scripts", {})
        has_lint_script = "lint" in package_json.get("scripts", {})
        
        print(f"{check_mark(has_test_script)} Test script configured")
        print(f"{check_mark(has_lint_script)} Lint script configured")
        
        checks.extend([has_test_script, has_lint_script])
    else:
        print(f"{check_mark(False)} savitara-app/package.json not found")
        checks.append(False)
    
    all_checks_passed &= all(checks)
    
    # Check 4: Web Apps
    print_header("4. Web Apps Configuration")
    checks = [
        check_file_exists("savitara-web/package.json", "savitara-web/package.json exists"),
        check_file_exists("savitara-web/vite.config.js", "Vite config exists"),
        check_file_exists("admin-savitara-web/package.json", "admin-web/package.json exists"),
        check_file_exists("admin-savitara-web/next.config.js", "Next.js config exists"),
    ]
    all_checks_passed &= all(checks)
    
    # Check 5: Environment Variables Template
    print_header("5. Environment Configuration")
    
    if os.path.exists("backend/.env"):
        print(f"{Colors.YELLOW}⚠{Colors.END}  .env file exists (should not be committed!)")
        
        # Check .gitignore
        gitignore_ok = False
        if os.path.exists(".gitignore"):
            with open(".gitignore", "r") as f:
                gitignore_ok = ".env" in f.read()
        
        print(f"{check_mark(gitignore_ok)} .env is in .gitignore")
        all_checks_passed &= gitignore_ok
    
    # Check 6: Deployment Guides
    print_header("6. Deployment Documentation")
    checks = [
        check_file_exists("RAILWAY_DEPLOYMENT.md", "Railway deployment guide exists"),
        check_file_exists("VERCEL_DEPLOYMENT.md", "Vercel deployment guide exists"),
    ]
    all_checks_passed &= all(checks)
    
    # Check 7: Database Configuration
    print_header("7. Database & Services")
    if os.path.exists("backend/.env"):
        with open("backend/.env", "r") as f:
            env_content = f.read()
        
        checks = [
            "MONGODB_URL" in env_content,
            "REDIS_URL" in env_content,
            "GOOGLE_CLIENT_ID" in env_content,
        ]
        
        print(f"{check_mark(checks[0])} MongoDB URL configured")
        print(f"{check_mark(checks[1])} Redis URL configured")
        print(f"{check_mark(checks[2])} Google OAuth configured")
        
        all_checks_passed &= all(checks)
    else:
        print(f"{Colors.YELLOW}⚠{Colors.END}  .env file not found (copy from .env.example)")
    
    # Final Summary
    print_header("Deployment Readiness Summary")
    
    if all_checks_passed:
        print(f"{Colors.GREEN}✓ Your project is ready for deployment!{Colors.END}\n")
        print("Next steps:")
        print("1. Push your code to GitHub")
        print("2. Follow RAILWAY_DEPLOYMENT.md to deploy backend")
        print("3. Follow VERCEL_DEPLOYMENT.md to deploy web apps")
        print("4. Update CORS and OAuth redirect URIs")
        print("5. Test all features in production\n")
        return 0
    else:
        print(f"{Colors.RED}✗ Some checks failed. Please fix the issues above.{Colors.END}\n")
        print("Common fixes:")
        print("- Run: git add . && git commit -m 'Fix CI/CD configuration'")
        print("- Ensure all configuration files are present")
        print("- Check GitHub Actions workflow syntax")
        print("- Verify package.json scripts exist\n")
        return 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Deployment check cancelled.{Colors.END}")
        sys.exit(1)
    except Exception as e:
        print(f"\n{Colors.RED}Error: {e}{Colors.END}")
        sys.exit(1)
