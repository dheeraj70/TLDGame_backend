import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as LinkedInStrategy } from 'passport-linkedin-oauth2';
import bcrypt from 'bcrypt';
import { getUserByUsername, getUserById, registerUser } from './database.js'; // Import functions to get and create user data from the database

// Local Strategy
passport.use(new LocalStrategy(async (username, password, done) => {
  try {
    const user = await getUserByUsername(username);
    if (!user) {
      return done(null, false, { message: 'No Account found !' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return done(null, false, { message: 'Incorrect password.' });
    }
    
    if (user.is_active === 0) {
      // User has not verified email
      return done(null, false, { message: 'You have not verified your email yet!' });
    }

    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

// Google Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await getUserByUsername(profile.emails[0].value);
    if (!user) {
      user = await registerUser(
        profile.emails[0].value,
        null, // No password for OAuth users
        'google', // OAuth provider
        profile.id, // OAuth ID
        profile.displayName, // Display name
        true //is active for oauth users
      );
    }
    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

// Facebook Strategy
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: '/auth/facebook/callback',
  profileFields: ['id', 'emails', 'name']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await getUserByUsername(profile.emails[0].value);
    if (!user) {
      user = await registerUser(
        profile.emails[0].value,
        null, // No password for OAuth users
        'facebook', // OAuth provider
        profile.id, // OAuth ID
        `${profile.name.givenName} ${profile.name.familyName}`, // Display name
        true //is active for oauth users
      );
    }
    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

// LinkedIn Strategy
passport.use(new LinkedInStrategy({
  clientID: process.env.LINKEDIN_CLIENT_ID,
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  callbackURL: '/auth/linkedin/callback',
  scope: ['r_emailaddress', 'r_liteprofile'],
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await getUserByUsername(profile.emails[0].value);
    if (!user) {
      user = await registerUser(
        profile.emails[0].value,
        null, // No password for OAuth users
        'linkedin', // OAuth provider
        profile.id, // OAuth ID
        profile.displayName, // Display name
        true //is active for oauth users
      );
    }
    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

// Serialize and deserialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await getUserById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;
