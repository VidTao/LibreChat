// Create LibreChat user with read/write access to LibreChat database
print("Starting mongo-init.js script...");
db = db.getSiblingDB('LibreChat');
print("Creating librechat_user...");
db.createUser({
  user: 'librechat_user',
  pwd: process.env.MONGO_PASSWORD,  // ← Back to using env variable
  roles: [
    {
      role: 'readWrite',
      db: 'LibreChat'
    }
  ]
});
print("User librechat_user created successfully!");