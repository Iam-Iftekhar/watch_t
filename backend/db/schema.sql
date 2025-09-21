-- MySQL Database Schema for Watch.T

-- Create the database if it doesn't exist
CREATE DATABASE IF NOT EXISTS watch_t_db;
USE watch_t_db;

-- Users Table
-- Stores user profile information
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,

    profile_pic VARCHAR(2048),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Friendships Table
-- Manages friend relationships
-- A user can be in user1_id or user2_id
CREATE TABLE friendships (
    user1_id VARCHAR(255) NOT NULL,
    user2_id VARCHAR(255) NOT NULL,
    status ENUM('pending', 'accepted') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user1_id, user2_id),
    FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
    -- Ensure user1_id < user2_id to prevent duplicate relationships
    CHECK (user1_id < user2_id)
);

-- Messages Table
-- Stores chat messages for Watch Together sessions
CREATE TABLE messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id VARCHAR(255) NOT NULL,
    receiver_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
);
