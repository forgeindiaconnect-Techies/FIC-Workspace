import mongoose from 'mongoose';

let lastConnectError: string | null = null;

/** Warn if password contains @ but was not URL-encoded */
export function validateMongoUri(uri: string): string | null {
  if (!uri || !uri.startsWith('mongodb')) {
    return 'MONGO_URI must start with mongodb:// or mongodb+srv://';
  }
  const withoutScheme = uri.replace(/^mongodb(\+srv)?:\/\//, '');
  const atCount = (withoutScheme.match(/@/g) || []).length;
  if (atCount > 1) {
    return (
      'MONGO_URI looks malformed: password contains "@"  encode it as %40 ' +
      '(example: Dhanushcj@123  Dhanushcj%40123)'
    );
  }
  return null;
}

export function getLastMongoError() {
  return lastConnectError;
}

export async function connectMongo(uri: string, log: { info: (m: string) => void; error: (m: string) => void; warn: (m: string) => void }) {
  const uriError = validateMongoUri(uri);
  if (uriError) {
    lastConnectError = uriError;
    log.error(uriError);
    throw new Error(uriError);
  }

  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    lastConnectError = null;
    log.info('Mongoose successfully established MongoDB connection.');
    return true;
  } catch (err: any) {
    let message = err.message;
    if (message.includes('bad auth')) {
      message =
        'MongoDB authentication failed  wrong username/password in MONGO_URI. ' +
        'In Atlas: Database Access  edit user  reset password (avoid @ in password), then update Render MONGO_URI.';
    }
    lastConnectError = message;
    log.error('Mongoose failed connecting to MongoDB: ' + message);
    throw new Error(message);
  }
}

export function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}
