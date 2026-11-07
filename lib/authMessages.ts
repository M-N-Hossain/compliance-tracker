// The two sentences a user can hear when a login or sign-up fails.
export const BAD_CREDENTIALS_MESSAGE = "Wrong email or password.";
export const SERVER_ERROR_MESSAGE =
  "Something went wrong on our side. Please try again in a moment.";

// Picks the sentence for the "error" value that signIn gives back.
// Auth.js reports a wrong password or unknown email as "CredentialsSignin".
// Every other value (such as "Configuration" when the server threw) is a server problem.
export function loginErrorMessage(error: string): string {
  return error === "CredentialsSignin" ? BAD_CREDENTIALS_MESSAGE : SERVER_ERROR_MESSAGE;
}
