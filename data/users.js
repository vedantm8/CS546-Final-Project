import { users } from "../config/mongoCollections.js";
import { checkInputsExistence, checkNumArguments, isStr, validateAge, validateEmail, validateName, validateUsername, validateIdAndReturnTrimmedId, trimArguments, validateListUserIds } from "../helpers.js";
import bcrypt from "bcryptjs";
import { ObjectId } from 'mongodb';
import { postData, commentData } from "./index.js";

const exportedMethods = {
    createUser: async (firstName, lastName, email, username, age, password) => {
        // Validate the number of inputs and ensure that each input exists
        const currArgs = [firstName, lastName, email, username, age, password];
        await checkNumArguments(currArgs, 6, 'createUser');
        await checkInputsExistence(currArgs);

        // Trim all non-array and non-id arguments 
        const trimmedArgs = await trimArguments(currArgs);
        firstName = trimmedArgs[0];
        lastName = trimmedArgs[1];
        email = trimmedArgs[2];
        username = trimmedArgs[3];
        age = trimmedArgs[4];
        password = trimmedArgs[5]

        // Validate if firstName and lastName are valid names
        await validateName(firstName, "createUser-firstName");
        await validateName(lastName, "createUser-lastName");
        
        // Validate if email input is a valid email
        await validateEmail(email, 'createUser-emailAddress')
        
        // Validate if username are valid inputs
        await validateUsername(username, "createdUser-username")

        // Validate is age is a valid input
        await validateAge(age, "createUser-validateAge");
        
        // Hash the password
        const hashedPassword = await exportedMethods.hashPassword(password);
        
        // Set the following inputs to empty array:
            // * followers
            // * following
            // * posts
            // * comments
        const followers = [], following = [], posts = [], comments = [];

        // Create new user object 
        const newUser = {
            firstName: firstName,
            lastName: lastName,
            email: email,
            username: username,
            age: age,
            password: hashedPassword,
            followers: followers,
            following: following,
            posts: posts,
            comments: comments
        }

        // Add user to database
        const userCollection = await users();
        const insertInfo = await userCollection.insertOne(newUser);
        if (!insertInfo.acknowledged || !insertInfo.insertedId)
            throw new Error('Could not add user');
        
        // Get ID and return user by getUserById
        const newId = insertInfo.insertedId.toString();
        const currUser = await exportedMethods.getUserById(newId);
        return currUser;
    },
    getAllUsers: async () => {
        const userCollection = await users();
        let userList = await userCollection.find({}).toArray();
        if (!userList) throw new Error('Could not get all users');
        userList = userList.map((element) => {
            element._id = element._id.toString();
            return element;
        });
        return userList;
    },
    getUserById: async (userId) => {
        // Validate input 
        await checkInputsExistence([userId])
        await checkNumArguments([userId], 1, "getUserById");
        await isStr(userId, "getUserById-userIdStr");

        // Check that user ID is in database
        userId = await validateIdAndReturnTrimmedId(userId);

        // Get all users and find user by id 
        const userCollection = await users();
        const user = await userCollection.findOne({ _id: new ObjectId(userId) });

        // If user is not found, throw an error 
        if (user === null) throw new Error('No user with that id');

        // Convert user id to string and return user object
        user._id = user._id.toString();
        return user;
    },
    removeUser: async (userId) => {
        await checkInputsExistence([userId])
        await checkNumArguments([userId], 1, "removeUserById");
        await isStr(userId, "removeUserById-userIdStr");
        await validateIdAndReturnTrimmedId(userId);

        const currMovie = await exportedMethods.getUserById(userId);
        
        // Delete all posts that the user created
        await postData.removePostsByUserId(userId);

        // Delete all comments that the user created
        await commentData.removeCommentsByUserId(userId);

        // Delete user from user collections
        const userCollection = await users();
        const deletionInfo = await userCollection.findOneAndDelete({
            _id: new ObjectId(userId)
        });

        if (!deletionInfo) {
            throw new Error(`Could not delete movie with id of ${userId}`);
        }

        return { ...currMovie, deleted: true };
    },
    hashPassword: async (password) => {
        // Validate inputs 
        await checkNumArguments([password], 1, "hashPassword")
        await checkInputsExistence([password]);
        await isStr(password, "hashPassword");

        // Generate a salt
        const saltRounds = 10;
        const salt = bcrypt.genSaltSync(saltRounds);

        // Hash the password using the generated salt
        const hashedPassword = bcrypt.hashSync(password, salt);
        return hashedPassword;
    },
    addFollower: async (userIdFollowing, userIdFollower) => {
        // Validate arguments
        const currArgs = [userIdFollowing, userIdFollower];
        await checkInputsExistence(currArgs);
        await checkNumArguments(currArgs, 2, "addFollower");
        userIdFollowing = await validateIdAndReturnTrimmedId(userIdFollowing);
        userIdFollower = await validateIdAndReturnTrimmedId(userIdFollower);
        await exportedMethods.getUserById(userIdFollowing);
        await exportedMethods.getUserById(userIdFollower);

        const userCollection = await users();
        
        // TODO: Add to following list 
        const addToFollowingList = await userCollection.findOneAndUpdate(
            { _id: new ObjectId(userIdFollowing) },
            { $push: { following: userIdFollower } },
            { returnDocument: 'after' }
        )
        
        // TODO: Add to follower list
        const addToFollowerList = await userCollection.findOneAndUpdate(
            { _id: new ObjectId(userIdFollower) },
            { $push: { followers: userIdFollowing } },
            { returnDocument: 'after' }
        )

        if (!addToFollowerList || !addToFollowingList)
            throw new Error("Could not add follower")
        
        return {
            userFollowing: addToFollowingList,
            userFollowed: addToFollowerList
        }
    },
    removeFollower: async (userIdFollowing, userIdFollower) => {
        // Validate arguments
        const currArgs = [userIdFollowing, userIdFollower];
        await checkInputsExistence(currArgs);
        await checkNumArguments(currArgs, 2, "addFollower");
        userIdFollowing = await validateIdAndReturnTrimmedId(userIdFollowing);
        userIdFollower = await validateIdAndReturnTrimmedId(userIdFollower);
        await exportedMethods.getUserById(userIdFollowing);
        await exportedMethods.getUserById(userIdFollower);

        // Remove FollowerId from following list 
        const userCollection = await users();
        await userCollection.updateOne(
            { _id: new ObjectId(userIdFollowing) },
            { $pull: { following: userIdFollower } } 
        )
        // Remove followingId from follower list
        await userCollection.updateOne(
            { _id: new ObjectId(userIdFollower) },
            { $pull: { followers: userIdFollowing } } 
        )
    }
}

export default exportedMethods;