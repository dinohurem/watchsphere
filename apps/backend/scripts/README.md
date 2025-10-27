# Backend Scripts

## Seed Admin User

Creates an initial admin user for accessing the admin panel.

### Usage

```bash
cd apps/backend
source venv/bin/activate
python scripts/seed_admin.py
```

### What it does

1. Connects to your MongoDB database
2. Creates an admin user if one doesn't exist:
   - **Email**: admin@watchsphere.com
   - **Password**: Admin123!
   - **Role**: ADMIN
   - **Verified**: true
   - **Active**: true

3. Optionally creates test users:
   - **Dealer**: dealer@watchsphere.com / Dealer123!
   - **Collector**: collector@watchsphere.com / Collector123!

### Security Note

⚠️ **IMPORTANT**: Change the default password after first login!

The default credentials are:
- Email: `admin@watchsphere.com`
- Password: `Admin123!`

These should NEVER be used in production without changing the password first.

### Running in Production

For production, you should:
1. Use environment variables for credentials
2. Generate a strong random password
3. Force password change on first login
4. Use a different admin email

Example production seed:

```python
import os

admin_email = os.getenv("ADMIN_EMAIL", "admin@yourdomain.com")
admin_password = os.getenv("ADMIN_PASSWORD")  # Required in production
```

### Troubleshooting

**Error: MongoDB connection refused**
- Make sure MongoDB is running: `brew services list | grep mongodb`
- Start MongoDB if needed: `brew services start mongodb/brew/mongodb-community@8.0`

**Error: Module not found**
- Make sure you're in the virtual environment: `source venv/bin/activate`
- Install dependencies: `pip install -r requirements.txt`

**User already exists**
- The script will skip creation if admin already exists
- To reset, delete the user from MongoDB:
  ```bash
  mongosh
  > use watchsphere
  > db.users.deleteOne({ email: "admin@watchsphere.com" })
  ```
