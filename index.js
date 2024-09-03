import express from "express";
import cors from 'cors';
import dotenv from 'dotenv';
import xlsx from 'xlsx';
import path from 'path';
import multer from 'multer';
import session from 'express-session';
import {sendEmail} from './mailer.js';
import {getGame, getGamesMetaData, getGameDesc, getCategories,getGamessofCategory, uploadGames, getGameURL, getCategoryName, getCategoryID, dislike,like, searchGame, registerUser, getUserByUsername, userUpdate, deleteUser, pairReferral, getUserByRefID, gettestrefs, storeVerificationToken, verifyToken, registerResend} from './database.js';
import bodyParser from "body-parser";
import passport from './auth.js'; // auth
import bcrypt from 'bcrypt';
import memorystore from 'memorystore';
import { v4 as uuidv4 } from 'uuid';



const upload = multer({ storage: multer.memoryStorage() });
const __dirname = path.resolve();
dotenv.config()
/*
const workbook = xlsx.readFile('tldgames.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const gamesData = xlsx.utils.sheet_to_json(worksheet);*/
//console.log(gamesData);

const corsOptions = {
    origin: process.env.REACT_APP_URL, // Specify the allowed origin
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS', // Specify the allowed HTTP methods
    credentials: true, // Allow credentials (cookies, authorization headers, etc.)
    optionsSuccessStatus: 204, // HTTP status code for successful preflight requests
  };
const MemoryStore = memorystore(session);
const app = express();
/*
app.use(session({
  store: new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  }),
  secret: 'StEvE',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 86400000, // 24 hours
    secure: true, // true if using HTTPS
    sameSite: 'none', // allows cross-site requests
    httpOnly: true, // helps prevent XSS attacks
  },
}));
*/
app.set("trust proxy", 1); //render has a reverse proxy --test
app.use(session({
  cookie: { maxAge: 86400000 ,sameSite: "none", secure: true },
  store: new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  }),
  resave: false,
  saveUninitialized: false,
  secret: 'StEvE'
}))
  
app.use(passport.initialize());
app.use(passport.session());

app.use(cors(corsOptions));

app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 

//middleWares
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: 'Unauthorized: Authentication required' });
  }
  


//auth routes
app.get('/current-user', ensureAuthenticated, (req, res) => {
    res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
      }
    });
  });

app.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
      if (err) {
        return res.status(500).json({ message: 'An error occurred during authentication.' });
      }
      if (!user) {
        // info.message will contain the error message from Passport.js
        return res.status(401).json({ message: info.message || 'Authentication failed.' });
      }
  
      req.logIn(user, (err) => {
        if (err) {
          return res.status(500).json({ message: 'An error occurred while logging in.' });
        }
  
        // Authentication successful
        res.json({ message: 'Login successful', user });
      });
    })(req, res, next);
  });
  
  // Google authentication routes
  app.get('/google', (req, res, next) => {
    const { refID } = req.query;
    const state = Buffer.from(JSON.stringify({ refID })).toString('base64');
    passport.authenticate('google', { scope: ['profile', 'email'], state })(req, res, next);
  });
  
  app.get('/auth/google/callback', (req, res, next) => {
    passport.authenticate('google', async (err, user, info) => {
      if (err) {
        return res.status(500).json({ message: 'An error occurred during Google authentication.' });
      }
      if (!user) {
        return res.status(401).json({ message: info.message || 'Google authentication failed.' });
      }
  
      req.logIn(user, async (err) => {
        if (err) {
          return res.status(500).json({ message: 'An error occurred while logging in with Google.' });
        }
  
        // Retrieve refID from state
        const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
        const refID = state.refID;
        //console.log('l136:'+ refID)
        if (refID) {
          try {
            const referedByUser = await getUserByRefID(refID);
            if (referedByUser) {
              await pairReferral(referedByUser, user.id);
            }
          } catch (err) {
            console.error('Error pairing referral:', err);
          }
        }else{
          try {
            await pairReferral(0, user.id);
          } catch (err) {
            console.error('Error pairing referral:', err);
          }
          
        }
  
        res.redirect(`${process.env.REACT_APP_URL}/`);
      });
    })(req, res, next);
  });
  

// Facebook authentication routes
app.get('/facebook', (req, res, next) => {
  const { refID } = req.query;
  const state = Buffer.from(JSON.stringify({ refID })).toString('base64');
  passport.authenticate('facebook', { scope: ['email'], state })(req, res, next);
});

app.get('/auth/facebook/callback', (req, res, next) => {
  passport.authenticate('facebook', async (err, user, info) => {
    if (err) {
      return res.status(500).json({ message: 'An error occurred during Facebook authentication.' });
    }
    if (!user) {
      return res.status(401).json({ message: info.message || 'Facebook authentication failed.' });
    }

    req.logIn(user, async (err) => {
      if (err) {
        return res.status(500).json({ message: 'An error occurred while logging in with Facebook.' });
      }

      // Retrieve refID from state
      const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
      const refID = state.refID;

      if (refID) {
        try {
          const referredByUser = await getUserByRefID(refID);
          if (referredByUser) {
            await pairReferral(referredByUser, user.id);
          }
        } catch (err) {
          console.error('Error pairing referral:', err);
        }
      }

      res.redirect(`${process.env.REACT_APP_URL}/`);
    });
  })(req, res, next);
});

// LinkedIn authentication routes
app.get('/linkedin', (req, res, next) => {
  const { refID } = req.query;
  const state = Buffer.from(JSON.stringify({ refID })).toString('base64');
  passport.authenticate('linkedin', { state })(req, res, next);
});

app.get('/auth/linkedin/callback', (req, res, next) => {
  passport.authenticate('linkedin', async (err, user, info) => {
    if (err) {
      return res.status(500).json({ message: 'An error occurred during LinkedIn authentication.' });
    }
    if (!user) {
      return res.status(401).json({ message: info.message || 'LinkedIn authentication failed.' });
    }

    req.logIn(user, async (err) => {
      if (err) {
        return res.status(500).json({ message: 'An error occurred while logging in with LinkedIn.' });
      }

      // Retrieve refID from state
      const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
      const refID = state.refID;

      if (refID) {
        try {
          const referredByUser = await getUserByRefID(refID);
          if (referredByUser) {
            await pairReferral(referredByUser, user.id);
          }
        } catch (err) {
          console.error('Error pairing referral:', err);
        }
      }

      res.json({ message: 'LinkedIn login successful', user });
    });
  })(req, res, next);
});


app.post('/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: 'Logout failed' });
      }
      res.json({ message: 'Logout successful' });
    });
  });
  

// Route to register a new user
app.post('/register', async (req, res) => {
  const { username, password, referedBy } = req.body;

  try {
    // Check if the username already exists
    const existingUser = await getUserByUsername(username);
    
    if (existingUser) {
      if(existingUser.is_active){
        //in the case when the user is not active yet and is registering again
        return res.status(400).json({ message: 'Username already exists' });
      }
      
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Register the new user
    let newUser;
    if(existingUser && !existingUser.is_active){
      //in the case when the user is not active yet and is registering again
      newUser = await registerResend(username, hashedPassword);
      //return res.status(200).json({ message: 'pending' });
    }else{
    newUser = await registerUser(username, hashedPassword);
    }
    // Generate a verification token
    const verificationToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

    // Store the token in the database
    await storeVerificationToken(newUser.id, verificationToken, expiresAt);

    // Send verification email
    const verificationUrl = `${process.env.HOSTNAME}/verify-email?token=${verificationToken}`;
    const emailContent = `
      <h2>TLD Games Email Verification</h2>
      <p>Click the link below to verify your email for your account!:</p>
      <a href="${verificationUrl}">${verificationUrl}</a>
    `;
    await sendEmail(username, 'TLD Games - Verify Your Email', emailContent);

    // Handle referral
    if (referedBy) {
      const referedByUser = await getUserByRefID(referedBy);
      if (referedByUser) {
        await pairReferral(referedByUser, newUser.id);
      }
    } else {
      await pairReferral(0, newUser.id);
    }

    res.status(201).json({ message: 'User registered successfully. Please check your email to verify your account.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/verify-email', async (req, res) => {
  const { token } = req.query;

  try {
    
    const verify = await verifyToken(token);
    
    if(verify === 200){
      res.sendFile(__dirname + '/view/verifysuccess.html');
    }else if(verify === 400){
      res.sendFile(__dirname + '/view/verifyfailed.html');
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});


app.get("/profile",ensureAuthenticated, async(req,res) =>{
    res.send(req.user);
})

//route to get all game data from gameID
app.get("/games/:gameID",async (req,res)=>{
    const gameID = req.params.gameID;
    const gameData =await getGame(gameID);
    res.send(gameData);
});


//route to get iframeURL and Description for a gameID
app.get("/gameDesc/:gameID",async (req,res)=>{
    const gameID = req.params.gameID;
    const gameData =await getGameDesc(gameID);
    res.send(gameData);
});

//route to get all data from categories table
app.get("/categories",async (req,res)=>{
    //const gameID = req.params.gameID;
    const categories =await getCategories();
    res.send(categories);
})

//get categoryname by id
app.get("/categoryname",async (req,res)=>{
    const {category_id} = req.query;
    //const gameID = req.params.gameID;
    const categoryname =await getCategoryName(category_id);
    res.send(categoryname);
})

//get categoryid by name
app.get("/categoryid",async (req,res)=>{
    const {category_name} = req.query;
    //const gameID = req.params.gameID;
    const categoryid =await getCategoryID(category_name);
    res.send(categoryid);
})

//route to get games based on category
/*app.get('/category/games', async (req,res)=>{

    const {category, page} = req.query;
    //console.log(category);
    const startIndex = (page-1)*6;
    const gamesArray = await getGamesofCategory(category, startIndex);
    if(gamesArray === null){
        res.send([]);
    }else{
        const gamesMetaData = await getGamesMetaData(gamesArray);
        res.send(gamesMetaData);
    }
    //console.log(gamesArray.games);
})*/

//get all games of a category
app.get('/category/games', async (req,res)=>{

    const {category_id, page} = req.query;
    //console.log(category);
    //const startIndex = (page-1)*6;
    const games = await getGamessofCategory(category_id, page);
    if(games === null){
        res.send([]);
    }else{
        //const gamesMetaData = await getGamesMetaData(gamesArray);
        res.send(games);
    }
    //console.log(gamesArray.games);
})

//liking a game
app.post('/likeGame/:gameID', async (req, res) => {
    const { gameID } = req.params;
    const result =  await like(gameID);
    res.sendStatus(result);
  });
  
//disliking a game
  app.post('/dislikeGame/:gameID', async (req, res) => {
    const { gameID } = req.params;
    const result = await dislike(gameID);
    res.sendStatus(result);
    
  });

//search game
app.get('/search', async(req,res) => {
    const {query, page} = req.query;
    const searchedGame = await searchGame(query,page);
    res.send(searchedGame);
})

//profile details
app.put('/profile', ensureAuthenticated,async(req,res)=>{
  try{
    const {id, username, display_name} = req.body;
    //console.log(req.body)
    const result = await userUpdate(id, username, display_name).then((result)=>res.sendStatus(result));
  }catch(err){
    console.log(err);
    res.sendStatus(500);
  }
})

app.delete('/profile', ensureAuthenticated,async(req,res)=>{
  try{
    const {id} = req.body;
    //console.log(req.body)
    const result = await deleteUser(id).then((result)=>res.sendStatus(result));
  }catch(err){
    console.log(err);
    res.sendStatus(500);
  }
})

app.get('/uploadGames',(req,res)=>{
    res.sendFile(__dirname + '/view/upload.html');
});

app.post('/uploadGames', upload.single('tldgames'), async (req, res) => {
    try {
      const fileBuffer = req.file.buffer;
  
      const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
      const sheetNames = workbook.SheetNames;
      const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetNames[0]]);

      const logs = await uploadGames(data);

      res.json(logs);
    } catch (err) {
      console.error('Error processing file.', err);
      res.status(500).send('Internal Server Error');
    }
  });
  
  app.get('/play/:gameid', async (req, res) => {
    const gameId = req.params.gameid;
    try {
        const { iframe_url } = await getGameURL(gameId);
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Game tld</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }

                    body, html {
                        width: 100%;
                        height: 100%;
                        overflow: hidden;
                        background: black;
                        color: red;
                        font-family: Arial, sans-serif;
                    }

                    #game-container {
                        position: relative;
                        width: 100%;
                        height: 100%;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                    }

                    #game-frame {
                        border: none;
                        position: absolute;
                    }

                    .ad-frame {
                        position: absolute;
                        z-index: 5;
                        pointer-events: none;
                        color: white;
                        font-size: 24px;
                        text-align: center;
                        display: none; /* Hide by default */
                    }

                    #top-ad {
                        background-color: rgb(247, 143, 7);
                    }

                    #bottom-ad {
                        background-color: rgb(0, 189, 227);
                    }

                    #left-ad {
                        background-color: rgb(73, 91, 1);
                    }

                    #right-ad {
                        background-color: rgb(118, 255, 143);
                    }
                </style>
            </head>
            <body>
                <div id="game-container">
                    <iframe title="game" id="game-frame" src="${iframe_url}" data-aspect-ratio="16/9"></iframe>
                    <div id="top-ad" class="ad-frame"></div>
                    <div id="bottom-ad" class="ad-frame"></div>
                    <div id="left-ad" class="ad-frame"></div>
                    <div id="right-ad" class="ad-frame"></div>
                </div>

                <script>
                    function updateSpaceInfo() {
                        const gameFrame = document.getElementById('game-frame');
                        const topAd = document.getElementById('top-ad');
                        const bottomAd = document.getElementById('bottom-ad');
                        const leftAd = document.getElementById('left-ad');
                        const rightAd = document.getElementById('right-ad');

                        const containerWidth = window.innerWidth;
                        const containerHeight = window.innerHeight;
            
                        const aspectRatio = gameFrame.getAttribute('data-aspect-ratio').split('/');
                        const gameRatio = aspectRatio[0] / aspectRatio[1];

                        let gameWidth = containerWidth;
                        let gameHeight = containerWidth / gameRatio;

                        if (gameHeight > containerHeight) {
                            gameHeight = containerHeight;
                            gameWidth = gameHeight * gameRatio;
                        }

                        const fullWidthCondition = containerWidth / containerHeight < gameRatio;

                        if (fullWidthCondition) {
                            gameFrame.style.width = \`\${containerWidth}px\`;
                            gameFrame.style.height = \`\${containerHeight}px\`;
                            gameFrame.style.left = '0';
                            gameFrame.style.top = '0';
                            topAd.style.display = 'none';
                            bottomAd.style.display = 'none';
                            leftAd.style.display = 'none';
                            rightAd.style.display = 'none';
                            return;
                        }

                        gameFrame.style.width = \`\${gameWidth}px\`;
                        gameFrame.style.height = \`\${gameHeight}px\`;
                        gameFrame.style.left = \`\${(containerWidth - gameWidth) / 2}px\`;
                        gameFrame.style.top = \`\${(containerHeight - gameHeight) / 2}px\`;

                        let extraWidth = containerWidth - gameWidth;
                        let extraHeight = containerHeight - gameHeight;

                        if (extraHeight / 2 > 10) {
                            topAd.style.display = 'block';
                            topAd.style.width = '100%';
                            topAd.style.height = \`\${extraHeight / 2}px\`;
                            topAd.style.top = '0';
                            topAd.style.left = '0';

                            bottomAd.style.display = 'block';
                            bottomAd.style.width = '100%';
                            bottomAd.style.height = \`\${extraHeight / 2}px\`;
                            bottomAd.style.bottom = '0';
                            bottomAd.style.left = '0';
                        } else {
                            topAd.style.display = 'none';
                            bottomAd.style.display = 'none';
                        }

                        if (extraWidth >= 200) {
                            leftAd.style.display = 'block';
                            leftAd.style.width = \`\${extraWidth / 2}px\`;
                            leftAd.style.height = '100%';
                            leftAd.style.top = '0';
                            leftAd.style.left = '0';

                            rightAd.style.display = 'block';
                            rightAd.style.width = \`\${extraWidth / 2}px\`;
                            rightAd.style.height = '100%';
                            rightAd.style.top = '0';
                            rightAd.style.right = '0';
                        } else if (extraWidth >= 100) {
                            leftAd.style.display = 'none';
                            rightAd.style.display = 'block';

                            if (extraWidth <= 50) {
                                gameWidth -= 50;
                                gameFrame.style.width = \`\${gameWidth}px\`;
                                extraWidth = containerWidth - gameWidth;
                            }

                            gameFrame.style.left = '0px';
                            rightAd.style.width = \`\${extraWidth}px\`;
                            rightAd.style.height = '100%';
                            rightAd.style.top = '0';
                            rightAd.style.right = '0';
                        } else {
                            leftAd.style.display = 'none';
                            rightAd.style.display = 'none';
                        }
                    }

                    window.onload = updateSpaceInfo;
                    window.onresize = updateSpaceInfo;
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Game tld</title>
            </head>
            <body>
                <h1>Error ${err}</h1>
            </body>
            </html>`)
    }
});

app.get('/referrals', async (req, res) => {
  try {
    // Function to convert JSON array to HTML table
    function jsonToTable(jsonArray) {
      if (!jsonArray.length) return '<p>No data available</p>';

      const keys = Object.keys(jsonArray[0]);
      let table = '<table border="1"><thead><tr>';

      // Create table headers
      keys.forEach(key => {
        table += `<th>${key}</th>`;
      });
      table += '</tr></thead><tbody>';

      // Create table rows
      jsonArray.forEach(item => {
        table += '<tr>';
        keys.forEach(key => {
          table += `<td>${item[key]}</td>`;
        });
        table += '</tr>';
      });

      table += '</tbody></table>';
      return table;
    }

    const refs = await gettestrefs();
    const htmlTable = jsonToTable(refs);
    res.send(htmlTable);
  } catch (error) {
    res.status(500).send('Error retrieving data');
  }
});



app.listen(process.env.PORT || 8080, function(){
    console.log("started")
});