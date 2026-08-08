import { cert, initializeApp } from 'firebase-admin/app';
import config from '../config';

const initializeFirebase = () => {
  if (
    config.firebase.projectId &&
    config.firebase.clientEmail &&
    config.firebase.privateKey
  ) {
    try {
      const privateKey = config.firebase.privateKey.replace(/\\n/g, '\n');

      initializeApp({
        credential: cert({
          projectId: config.firebase.projectId,
          clientEmail: config.firebase.clientEmail,
          privateKey: privateKey,
        }),
      });
    } catch (error) {
      console.error('Failed to initialize Firebase Admin SDK:', error);
    }
  } else {
    console.warn(
      'Firebase Admin credentials are not fully configured in environment. Social login verification will not work.',
    );
  }
};

export default initializeFirebase;
