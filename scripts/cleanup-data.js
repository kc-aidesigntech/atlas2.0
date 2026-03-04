import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { 
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  doc
} from 'firebase/firestore';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from parent directory (.env.local preferred)
const envLocalPath = join(__dirname, '../.env.local');
const envPath = join(__dirname, '../.env');
console.log(`📁 Loading environment from: ${envLocalPath} (fallback: ${envPath})`);
const result = dotenv.config({ path: envLocalPath });
if (result.error) {
  const fallbackResult = dotenv.config({ path: envPath });
  if (fallbackResult.error) {
    console.error('❌ Error loading .env.local and .env:', fallbackResult.error);
    console.log('\n💡 Make sure .env.local (or .env) exists in the atlas directory with your Firebase config');
    process.exit(1);
  }
}

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

// Validate that we have the required config
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Missing Firebase configuration!');
  process.exit(1);
}

console.log('✅ Firebase configuration loaded successfully\n');

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = process.env.VITE_APP_ID || process.env.APP_ID || 'demo-app'; // Must match the app's appId

async function cleanupData() {
  try {
    console.log('🔐 Authenticating with Firebase...');
    await signInAnonymously(auth);
    console.log('✅ Authenticated successfully\n');

    console.log('🧹 Starting data cleanup...\n');

    // Delete all resources
    console.log('🗑️  Deleting resources...');
    const resourcesRef = collection(db, `artifacts/${appId}/public/data/resources`);
    const resourcesSnapshot = await getDocs(resourcesRef);
    let count = 0;
    for (const docSnap of resourcesSnapshot.docs) {
      await deleteDoc(doc(db, `artifacts/${appId}/public/data/resources`, docSnap.id));
      count++;
      console.log(`  ✅ Deleted resource ${count}/${resourcesSnapshot.size}`);
    }
    console.log(`✅ Deleted ${count} resources\n`);

    // Delete all enrollees
    console.log('🗑️  Deleting enrollees...');
    const enrolleesRef = collection(db, `artifacts/${appId}/public/data/enrollees`);
    const enrolleesSnapshot = await getDocs(enrolleesRef);
    count = 0;
    for (const docSnap of enrolleesSnapshot.docs) {
      await deleteDoc(doc(db, `artifacts/${appId}/public/data/enrollees`, docSnap.id));
      count++;
      console.log(`  ✅ Deleted enrollee ${count}/${enrolleesSnapshot.size}`);
    }
    console.log(`✅ Deleted ${count} enrollees\n`);

    // Delete all referrals
    console.log('🗑️  Deleting referrals...');
    const referralsRef = collection(db, `artifacts/${appId}/public/data/referrals`);
    const referralsSnapshot = await getDocs(referralsRef);
    count = 0;
    for (const docSnap of referralsSnapshot.docs) {
      await deleteDoc(doc(db, `artifacts/${appId}/public/data/referrals`, docSnap.id));
      count++;
      console.log(`  ✅ Deleted referral ${count}/${referralsSnapshot.size}`);
    }
    console.log(`✅ Deleted ${count} referrals\n`);

    console.log('🎉 Cleanup complete!\n');
    console.log('💡 Now run: npm run seed');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error cleaning up data:', error);
    process.exit(1);
  }
}

cleanupData();

