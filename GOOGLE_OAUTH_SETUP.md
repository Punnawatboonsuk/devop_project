# Google OAuth Setup Guide

This guide explains how to set up Google OAuth for the Nisit Deeden Award System with KU email restrictions.

## Prerequisites

1. Google Cloud Console access
2. Application is running and accessible (for development: http://localhost:3000)

## Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth client ID**
5. Choose **Web application** as the application type

## Step 2: Configure OAuth Consent Screen

Before creating credentials, you may need to configure the OAuth consent screen:

1. Go to **APIs & Services** > **OAuth consent screen**
2. Choose **External** user type (for testing) or **Internal** (for KU users only)
3. Fill in the required information:
   - App name: "Nisit Deeden Award System"
   - User support email: your email
   - Developer contact email: your email
4. Save and continue

## Step 3: Set Authorized Redirect URIs

In the OAuth client ID creation form, add these redirect URIs:

```
http://localhost:3000/auth/google/callback
http://localhost:3000/auth/google-callback
```

For production, add your production domain URIs.

## Step 4: Get Client ID and Secret

After creating the OAuth client, you'll receive:
- **Client ID**: Your Google OAuth Client ID
- **Client Secret**: Your Google OAuth Client Secret

## Step 5: Configure Environment Variables

Update your `.env` file (create if it doesn't exist) with your Google OAuth credentials:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

**Note**: Replace the placeholder values with your actual Google OAuth credentials.

## Step 6: Run Database Migration

Run the migration to add the Google OAuth fields to your database:

```bash
cd server
npm run migrate
```

## Step 7: Test Google OAuth

1. Start your application
2. Go to the login page
3. Click "Login with Google (KU Email Only)"
4. You should be redirected to Google's OAuth consent screen
5. After authentication, you'll be redirected back to your application

## Security Features

### KU Email Restriction

The system automatically validates that users have KU email addresses:
- Only `@ku.th` and `@live.ku.th` email addresses are accepted
- Users with other email addresses will receive an error message
- This restriction is enforced in both the backend and frontend

### Session Management

- Google OAuth users get the same session management as regular users
- Users are assigned the STUDENT role by default
- Existing users with matching email addresses will be updated, not duplicated

## Troubleshooting

### Common Issues

1. **"Error: redirect_uri_mismatch"**
   - Check that your redirect URIs in Google Cloud Console match exactly
   - Ensure you're using the correct callback URL

2. **"Only KU email addresses are allowed"**
   - This is expected behavior for non-KU Google accounts
   - Only users with @ku.th or @live.ku.th emails can authenticate

3. **"Invalid client" or "Invalid grant"**
   - Verify your Client ID and Secret are correct
   - Check that your environment variables are properly set

### Development vs Production

For production deployment:
1. Update the redirect URIs in Google Cloud Console to your production domain
2. Update `GOOGLE_CALLBACK_URL` in your production environment variables
3. Consider using "Internal" OAuth consent screen for KU-only access

## Security Notes

- Never commit your `.env` file to version control
- Use different OAuth credentials for development and production
- Regularly review and rotate your OAuth credentials
- Monitor Google Cloud Console for any suspicious OAuth activity

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Passport.js Google OAuth Strategy](https://www.passportjs.org/packages/passport-google-oauth20/)
- [Google Cloud Console](https://console.cloud.google.com/)