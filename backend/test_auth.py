"""
Test authentication functionality.
"""

import asyncio
from services import get_supabase_client

async def test_auth():
    print("=" * 70)
    print("TESTING AUTHENTICATION SYSTEM")
    print("=" * 70)
    print()

    db = get_supabase_client()

    # Test 1: Check if users table exists
    print("1. Checking users table...")
    try:
        result = db.client.table("users").select("*").limit(1).execute()
        print(f"   ✅ Users table exists ({len(result.data)} sample records)")
    except Exception as e:
        print(f"   ❌ Users table error: {e}")
        return

    print()

    # Test 2: Check if we can create a test user in Supabase Auth
    print("2. Testing user registration...")
    test_email = "nurse@hospital.com"
    test_password = "nurse123"

    try:
        # Try to sign up (will fail if user already exists)
        auth_response = db.client.auth.sign_up({
            "email": test_email,
            "password": test_password,
            "options": {
                "data": {
                    "first_name": "Test",
                    "last_name": "Nurse",
                    "role": "nurse"
                }
            }
        })

        if auth_response.user:
            print(f"   ✅ Test user created: {test_email}")
            user_id = auth_response.user.id

            # Create profile in users table
            user_data = {
                "id": user_id,
                "email": test_email,
                "role": "nurse",
                "first_name": "Test",
                "last_name": "Nurse",
                "is_active": True
            }
            created_user = await db.create_user(user_data)
            if created_user:
                print(f"   ✅ User profile created in users table")
        else:
            print(f"   ⚠️  User might already exist")

    except Exception as e:
        error_msg = str(e)
        if "already registered" in error_msg.lower() or "duplicate" in error_msg.lower():
            print(f"   ℹ️  Test user already exists: {test_email}")
        else:
            print(f"   ❌ Registration error: {e}")

    print()

    # Test 3: Test login
    print("3. Testing login...")
    try:
        auth_response = db.client.auth.sign_in_with_password({
            "email": test_email,
            "password": test_password
        })

        if auth_response.session:
            print(f"   ✅ Login successful!")
            print(f"   Access token: {auth_response.session.access_token[:20]}...")
            print(f"   User ID: {auth_response.user.id}")
            print(f"   Email: {auth_response.user.email}")

            # Test getting user profile
            user_profile = await db.get_user_by_email(test_email)
            if user_profile:
                print(f"   ✅ User profile found: {user_profile.get('first_name')} {user_profile.get('last_name')}")
            else:
                print(f"   ⚠️  User profile not found in users table")

        else:
            print(f"   ❌ Login failed - no session returned")

    except Exception as e:
        print(f"   ❌ Login error: {e}")

    print()
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print()
    print("Demo Credentials:")
    print(f"  Email: {test_email}")
    print(f"  Password: {test_password}")
    print()
    print("To test in the frontend:")
    print("  1. Start backend: cd backend && uvicorn main:app --reload")
    print("  2. Start frontend: cd frontend && npm run dev")
    print("  3. Visit http://localhost:5173/login")
    print("  4. Use the demo credentials above")

# Run the test
asyncio.run(test_auth())
