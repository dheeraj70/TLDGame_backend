import mysql from "mysql2";
import dotenv from "dotenv";
import { v4 as uuidv4 } from 'uuid';
dotenv.config();

const pool = mysql
  .createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  })
  .promise();

  export async function registerUser(username, hashedPassword = null, oauthProvider = null, oauthId = null, displayName = null, is_active = false) {
    try {
      
      // Generate a unique refID using UUID
      const refID = uuidv4(); // Generates a UUID v4
      //console.log(refID);
      // Insert the new user into the database
      const [result] = await pool.query(
        'INSERT INTO users (username, password, oauth_provider, oauth_id, display_name, refID, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          username,
          hashedPassword,
          oauthProvider || null,
          oauthId || null,
          displayName || username, // Use username if displayName is not provided
          refID,
          is_active
        ]
      );
  
      // Return the newly created user with refID
      return { id: result.insertId, username, refID };
    } catch (error) {
      throw new Error('Failed to register user: ' + error.message);
    }
  }

  export async function registerResend(username, hashedPassword = null, oauthProvider = null, oauthId = null, displayName = null, is_active = false) {
    try {
      // Generate a new unique refID using UUID (if needed)
      const refID = uuidv4(); // Generates a UUID v4
  
      // Retrieve the user's ID based on the username
      const [userRows] = await pool.query(
        'SELECT id FROM users WHERE username = ?',
        [username]
      );
  
      // Check if the user exists
      if (userRows.length === 0) {
        throw new Error('User not found');
      }
  
      const userId = userRows[0].id;
  
      // Update the user information in the database where the username matches
      await pool.query(
        `UPDATE users 
         SET password = ?, 
             oauth_provider = ?, 
             oauth_id = ?, 
             display_name = ?, 
             refID = ?, 
             is_active = ?
         WHERE username = ?`,
        [
          hashedPassword,
          oauthProvider || null,
          oauthId || null,
          displayName || username, // Use username if displayName is not provided
          refID,
          is_active,
          username
        ]
      );
  
      // Return the updated user information including the ID
      return { id: userId, username, refID };
    } catch (error) {
      throw new Error('Failed to update user: ' + error.message);
    }
  }
  
  
  export async function getUserByUsername(username) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM users WHERE username = ?',
        [username]
      );
      return rows.length ? rows[0] : null; // Return null if no user is found
    } catch (error) {
      throw new Error('Failed to get user by username: ' + error.message);
    }
  }
  
  export async function getUserById(id) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM users WHERE id = ?',
        [id]
      );
      return rows.length ? rows[0] : null; // Return null if no user is found
    } catch (error) {
      throw new Error('Failed to get user by ID: ' + error.message);
    }
  }

  export const userUpdate = async (id, username, display_name) => {
    try {
      const [rows] = await pool.query(
        "UPDATE users SET username = ?, display_name = ? WHERE id = ?",
        [username, display_name, id]
      );
  
      return 200;
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        console.log("Duplicate entry error: ", err);
        return 409; 
      } else {
        console.log("Database error: ", err);
        return 500; 
      }
    }
  };

  export const storeVerificationToken = async (userId, token, expiresAt) => {
    try {
      // First, delete any existing token for this user
      await pool.query('DELETE FROM verificationtokens WHERE user_id = ?', [userId]);
  
      // Insert the new token
      await pool.query(
        'INSERT INTO verificationtokens (user_id, token, expires_at) VALUES (?, ?, ?)',
        [userId, token, expiresAt]
      );
    } catch (err) {
      console.log('Error storing verification token:', err);
    }
  };
  
  
export const verifyToken = async(token) =>{
  try {
    // Retrieve the token from the database
    const [rows] = await pool.query('SELECT * FROM verificationtokens WHERE token = ?', [token]);

    if (rows.length === 0) {
      return 400;
    }

    const verificationToken = rows[0];

    if (new Date() > new Date(verificationToken.expires_at)) {
      return 400;
    }

    // Mark the user as active
    await pool.query('UPDATE users SET is_active = TRUE WHERE id = ?', [verificationToken.user_id]);

    // Delete the token after verification
    await pool.query('DELETE FROM verificationtokens WHERE id = ?', [verificationToken.id]);

    return 200;
  } catch (error) {
    console.error(error);
    return 500;
  }
}

  export const deleteUser = async (user_id) => {
    try {
      // Delete related records in the referrals table first
      await pool.query('UPDATE referrals SET referred_id = NULL WHERE referred_id = ?', [user_id]);
      
      await pool.query('UPDATE referrals SET referrer_id = NULL WHERE referrer_id = ?', [user_id]);

      // Now delete the user
      await pool.query('DELETE FROM users WHERE id = ?', [user_id]);
  
      return 200;
    } catch (err) {
      console.log('Database error: ', err);
      return 500;
    }
  };
  

export const pairReferral = async (referrerId, referredId) => {
  try {
    if (referrerId === 0 || reffererId >= referredId){
      return { success: false, message: 'Conditions not met' };
    }
    // Check if the referral already exists
    const [existingReferral] = await pool.query(
      'SELECT * FROM referrals WHERE referrer_id = ? AND referred_id = ?',
      [referrerId, referredId]
    );

    if (existingReferral.length > 0) {
      return { success: false, message: 'Referral already exists' };
    }

    // Insert the new referral into the referrals table
    const [result] = await pool.query(
      'INSERT INTO referrals (referrer_id, referred_id) VALUES (?, ?)',
      [referrerId, referredId]
    );

    return { success: true, referralId: result.insertId };
  } catch (error) {
    console.error('Error pairing referral:', error);
    return { success: false, message: 'Failed to pair referral' };
  }
};

export const getUserByRefID = async(refID)=>{
  const [rows] = await pool.query('SELECT id FROM users where refID = ?',[refID]);
  if(rows.length > 0){
  return(rows[0].id);}else{
    return false;
  }
}


export const getGame = async (gameID) => {
  const [rows] = await pool.query("SELECT * FROM Games WHERE GAME_ID = ?", [
    gameID,
  ]);
  return rows[0];
};

export const getGameMetaData = async (gameID) => {
  const [rows] = await pool.query(
    "SELECT game_id,name,banner_url,like_count,dislike_count,tags FROM Games WHERE GAME_ID = ?",
    [gameID]
  );
  return rows;
};
export const getGamesMetaData = async (gamesArray) => {
  const promises = gamesArray.map(async (game) => {
    const gameDat = await getGameMetaData(game);
    return gameDat[0];
  });

  const games = await Promise.all(promises);
  return games;
};

export const getGameDesc = async (gameID) => {
  const [rows] = await pool.query(
    "SELECT description, tags FROM Games WHERE GAME_ID = ?",
    [gameID]
  );
  return rows[0];
  //return rows;
};

export const getGameURL = async (gameID) => {
  const [rows] = await pool.query(
    "SELECT iframe_url FROM Games WHERE GAME_ID = ?",
    [gameID]
  );
  return rows[0];
  //return rows;
};

export const getCategories = async () => {
  const [rows] = await pool.query(
    "SELECT category_id, NAME AS CATEGORY_NAME, SVG FROM categories"
  );
  return rows;
};

export const getCategoryName = async (category_id) => {
  const [rows] = await pool.query(
    "SELECT NAME AS CATEGORY_NAME FROM categories WHERE category_id = ?",[category_id]
  );
  return rows;
};


export const searchGame = async (query, page) => {
    const limit = 10;
    const offset = (page-1)*limit;
    const [rows] = await pool.query(
      "SELECT * FROM Games WHERE name LIKE ? LIMIT ? OFFSET ?",
      [`%${query}%`, limit, offset]
    );
    return rows;
 
};

export const getCategoryID = async (category_name) => {
  const [rows] = await pool.query(
    "SELECT category_id FROM categories WHERE NAME = ?",[category_name]
  );
  return rows;
};

export const dislike = async(game_id) => { 
  try {
    await pool.query('UPDATE Games SET dislike_count = dislike_count + 1 WHERE game_id = ?', [game_id]);
    return 200;
  } catch (err) {
    console.error(err);
    return 500;
  }
}

export const like = async(game_id) => { 
  try {
    await pool.query('UPDATE Games SET like_count = like_count + 1 WHERE game_id = ?', [game_id]);
    return 200;
  } catch (err) {
    console.error(err);
    return 500;
  }
}


export const getGamessofCategory = async (category_id, page) => {
  // Fetch game IDs for the given category with offset
  const limit = 10;
  const offset = (page-1)*limit;
  const [rows] = await pool.query(
    `SELECT game_id as games FROM gamecategories WHERE category_id = ? LIMIT ? OFFSET ?`,
    [category_id,limit, offset]
  );

  // Retrieve metadata for each game and store in an array
  const gamesMetaData = await Promise.all(
    rows.map(async (row) => {
      const metaData = await getGameMetaData(row.games);
      return metaData[0];
    })
  );

  return gamesMetaData;
};


export const uploadGames = async (gamesArray) => {
  const logs = [];

  for (const game of gamesArray) {
    try {
      const [existingGame] = await pool.query('SELECT game_id FROM Games WHERE name = ?', [game.name]);

      if (existingGame.length === 0) {
        const tags = game.tags ? game.tags.split(' ') : [];

        if (!game.name || !game.iframe_url) {
          const msg = `Missing required properties for game "${game.name}"`;
          console.log(msg);
          logs.push(msg);
          continue;
        }

        const [result] = await pool.query(
          `INSERT INTO Games (name, iframe_url, banner_url, like_count, dislike_count, tags, description)
           VALUES (?, ?, ?, ?, ?, CAST(? AS JSON), ?)`,
          [
            game.name,
            game.iframe_url,
            game.banner_url || './noimg.png',
            game.like_count || 0,
            game.dislike_count || 0,
            JSON.stringify(tags),
            game.description || ""
          ]
        );

        const gameID = result.insertId;
        const msg = `Game "${game.name}" inserted with ID: ${gameID}`;
        console.log(msg);
        logs.push(msg);

        for (const tag of tags) {
          const [category] = await pool.query('SELECT category_id FROM categories WHERE name = ?', [tag]);

          let categoryID;
          if (category.length === 0) {
            const [insertedCategory] = await pool.query(
              `INSERT INTO categories (name) VALUES (?)`,
              [tag]
            );
            categoryID = insertedCategory.insertId;
            const msg = `Category "${tag}" created.`;
            console.log(msg);
            logs.push(msg);
          } else {
            categoryID = category[0].category_id;
          }

          await pool.query(
            `INSERT INTO gamecategories (game_id, category_id) VALUES (?, ?)`,
            [gameID, categoryID]
          );

          const msg = `Game "${game.name}" added to category: ${tag}`;
          console.log(msg);
          logs.push(msg);
        }
      } else {
        const msg = `Game "${game.name}" already exists.`;
        console.log(msg);
        logs.push(msg);

        if (game.forced_update) {
          const gameID = existingGame[0].game_id;

          const updateFields = [];
          const values = [];

          if (game.iframe_url) {
            updateFields.push('iframe_url = ?');
            values.push(game.iframe_url);
          }
          if (game.banner_url) {
            updateFields.push('banner_url = ?');
            values.push(game.banner_url);
          }
          if (game.like_count) {
            updateFields.push('like_count = ?');
            values.push(game.like_count);
          }
          if (game.dislike_count) {
            updateFields.push('dislike_count = ?');
            values.push(game.dislike_count);
          }
          if (game.tags) {
            updateFields.push('tags = CAST(? AS JSON)');
            values.push(JSON.stringify(game.tags.split(' ')));
          }
          if (game.description) {
            updateFields.push('description = ?');
            values.push(game.description);
          }
          if (updateFields.length > 0) {
            values.push(gameID);

            const query = `UPDATE Games SET ${updateFields.join(', ')} WHERE game_id = ?`;
            await pool.query(query, values);

            const msg = `Game "${game.name}" updated with ID: ${gameID}`;
            console.log(msg);
            logs.push(msg);

            if (game.tags) {
              const parsedTags = JSON.parse(JSON.stringify(game.tags.split(' ')));
              for (const tag of parsedTags) {
                const [category] = await pool.query('SELECT category_id FROM categories WHERE name = ?', [tag]);

                let categoryID;
                if (category.length === 0) {
                  const [insertedCategory] = await pool.query(
                    `INSERT INTO categories (name) VALUES (?)`,
                    [tag]
                  );
                  categoryID = insertedCategory.insertId;
                  const msg = `Category "${tag}" created.`;
                  console.log(msg);
                  logs.push(msg);
                } else {
                  categoryID = category[0].category_id;
                }

                const [existingRelation] = await pool.query(
                  'SELECT * FROM gamecategories WHERE game_id = ? AND category_id = ?',
                  [gameID, categoryID]
                );

                if (existingRelation.length === 0) {
                  await pool.query(
                    `INSERT INTO gamecategories (game_id, category_id) VALUES (?, ?)`,
                    [gameID, categoryID]
                  );
                  const msg = `Game "${game.name}" added to category: ${tag}`;
                  console.log(msg);
                  logs.push(msg);
                } else {
                  const msg = `Game "${game.name}" is already in category: ${tag}`;
                  console.log(msg);
                  logs.push(msg);
                }
              }
            }
          } else {
            const msg = `No update needed for game "${game.name}".`;
            console.log(msg);
            logs.push(msg);
          }
        }
      }
    } catch (err) {
      const msg = `Error inserting game "${game.name}".`;
      logs.push(msg);
      console.error(`Error inserting game "${game.name}": `, err);
    }
  }
  return logs;
};

export const gettestrefs = async ()=>{
  try{
    const [refs] = await pool.query('SELECT * from referrals');
    return refs;
  }catch(err){
    console.log(err)
    return 'error';
  }
}