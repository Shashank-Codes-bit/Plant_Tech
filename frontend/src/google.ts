// Google sign-in for owners. Off until the Google Cloud client IDs exist and the native
// module (@react-native-google-signin/google-signin) is added to the dev/QA/prod builds.
// Then: set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, and implement signInWithGoogle() to return the idToken.
export const googleAvailable = false;

export async function signInWithGoogle(): Promise<string> {
  throw new Error("Google sign-in is not set up yet");
}
