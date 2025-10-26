# Import Sample Data to Firestore

## Option 1: Firebase Console (Easiest - Manual)

### Step 1: Add Resources

1. Go to Firebase Console → Firestore Database
2. Click **"Start collection"**
3. Collection ID: `artifacts/atlas-demo/public/data/resources`
4. Click **"Next"**
5. For each resource in `resources.json`, click **"Add document"**:
   - Auto-generate Document ID
   - Copy/paste the fields from the JSON

**OR** Click on the collection and use **"Add document"** for each resource.

### Step 2: Add Enrollees

1. Create collection: `artifacts/atlas-demo/public/data/enrollees`
2. Add 3 documents from `enrollees.json`
3. **IMPORTANT:** Note the auto-generated document IDs

### Step 3: Update Your User Profile

1. Create collection: `artifacts/{atlas-demo}/users/{YOUR_USER_ID}/profile`
2. Create document with ID: `main`
3. Add fields:
   ```
   name: "Your Name"
   role: "Certified Peer Counselor"
   email: "your@email.com"
   assignedEnrollees: [array of enrollee IDs from Step 2]
   ```

---

## Option 2: Firebase CLI (Faster - If You Want to Script It)

```bash
cd /Users/kc_ai-designtech/atlas

# Login to Firebase
firebase login

# Initialize Firestore (if not done)
firebase init firestore

# Use the Firebase Admin SDK to import data
# (Would require creating a Node.js script)
```

---

## Option 3: Create Manually in the App (Simplest!)

1. Open `http://localhost:5173`
2. Click **"New Enrollee"** in sidebar
3. Fill in the form for each enrollee:
   - Sandra Morrison, DOB: 1989-03-15
   - Marcus Thompson, DOB: 1995-07-22
   - Elena Rodriguez, DOB: 2001-11-08
4. For Resources, use Firebase Console to add the 7 resources

---

## Recommended Approach

**Use the App + Firebase Console combo:**

1. **Create Enrollees via App** (easiest, handles all relationships)
   - Go to http://localhost:5173
   - Click "New Enrollee" 3 times
   - Fill in basic info for each

2. **Add Resources via Firebase Console**
   - Much faster to bulk add
   - Copy from resources.json

3. **Update Risk Profiles via Firebase Console** (optional)
   - Edit each enrollee document
   - Add the riskProfile data from enrollees.json

This way the app handles all the complex relationships (assignedEnrollees, careTeam) automatically!

