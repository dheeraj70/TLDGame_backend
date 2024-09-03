
CREATE DATABASE tldgames;
USE tldgames;

CREATE TABLE `categories` (
  `name` varchar(255) NOT NULL,
  `category_id` int NOT NULL AUTO_INCREMENT,
  `svg` varchar(255) DEFAULT 'gamepad',
  PRIMARY KEY (`name`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `category_id` (`category_id`)
);

CREATE TABLE `gamecategories` (
  `game_id` int NOT NULL,
  `category_id` int NOT NULL,
  PRIMARY KEY (`game_id`,`category_id`),
  KEY `category_id` (`category_id`),
  CONSTRAINT `gamecategories_ibfk_1` FOREIGN KEY (`game_id`) REFERENCES `games` (`game_id`) ON DELETE CASCADE,
  CONSTRAINT `gamecategories_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `categories` (`category_id`) ON DELETE CASCADE
);

CREATE TABLE `games` (
  `game_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `iframe_url` text NOT NULL,
  `banner_url` text,
  `like_count` int DEFAULT '0',
  `dislike_count` int DEFAULT '0',
  `tags` json DEFAULT NULL,
  `description` text,
  PRIMARY KEY (`game_id`),
  UNIQUE KEY `unique_name` (`name`)
);

--insert example values :
