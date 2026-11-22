import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
  type User,
} from '@react-native-google-signin/google-signin';

import { t } from './i18n';

/**
 * The "Zort web" OAuth client in Google Cloud. Not a secret: Android apps are recognised by
 * their package name and signing key (the "Zort debug" / "Zort release" Android clients, see
 * README), this only names the project.
 */
const WEB_CLIENT_ID = '15595475837-0ak44qr8nppp3chsen5lt2m9rsui85i4.apps.googleusercontent.com';

/** The app's own hidden folder in the user's Drive: it can't see any of their files. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

export type Account = { email: string; name: string | null; photo: string | null };

let configured = false;
function configure() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, scopes: [DRIVE_SCOPE] });
  configured = true;
}

const toAccount = ({ user }: User): Account => ({ email: user.email, name: user.name, photo: user.photo });

/** The account signed in on an earlier launch, without asking the user anything. */
export async function restoreSession(): Promise<Account | null> {
  configure();
  if (!GoogleSignin.hasPreviousSignIn()) return null;
  const response = await GoogleSignin.signInSilently();
  return response.type === 'success' ? toAccount(response.data) : null;
}

/** Shows Google's account picker; null if the user backs out of it. */
export async function signIn(): Promise<Account | null> {
  configure();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return null;
  // Drive access is asked for with the sign-in, but the user can still turn it down
  if (!response.data.scopes.includes(DRIVE_SCOPE)) {
    const granted = await GoogleSignin.addScopes({ scopes: [DRIVE_SCOPE] });
    if (!granted || !isSuccessResponse(granted) || !granted.data.scopes.includes(DRIVE_SCOPE)) {
      await GoogleSignin.signOut().catch(() => {});
      throw new Error(t('backupNeedsDrive'));
    }
  }
  return toAccount(response.data);
}

export async function signOut(): Promise<void> {
  await GoogleSignin.signOut();
}

export async function accessToken(): Promise<string> {
  return (await GoogleSignin.getTokens()).accessToken;
}

/** For a token Drive turned down (expired or revoked): drop it and get a new one. */
export async function freshAccessToken(rejected: string): Promise<string> {
  await GoogleSignin.clearCachedAccessToken(rejected);
  return accessToken();
}

/** A message for the user; null when there's nothing to say (they cancelled). */
export function signInErrorMessage(error: unknown): string | null {
  if (isErrorWithCode(error)) {
    switch (error.code) {
      case statusCodes.SIGN_IN_CANCELLED:
      case statusCodes.IN_PROGRESS:
        return null;
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return t('backupNoPlayServices');
      // DEVELOPER_ERROR: this build's signing key isn't registered in Google Cloud
      case '10':
        return t('backupNotConfigured');
    }
  }
  return error instanceof Error && error.message ? error.message : t('backupSignInFailed');
}
