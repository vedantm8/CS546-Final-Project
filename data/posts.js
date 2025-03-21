import { posts, users } from "../config/mongoCollections.js";
import { checkInputsExistence, checkNumArguments, validateUserIdAndReturnTrimmedId, trimArguments, getTodayDate, isStr } from "../helpers.js";
import { userData } from "./index.js";
import { ObjectId } from 'mongodb';

const exportedMethods = {
    createPost: async (userId, content, imageUrl=null) => {
        // Depending on if post has an image url, validate
        if (imageUrl === null) {
            const currArgs = [userId, content];
            await checkInputsExistence(currArgs);
            await checkNumArguments(currArgs, 2, "createPostNoImage");
        } else {
            const currArgs = [userId, content, imageUrl];
            await checkInputsExistence(currArgs);
            await checkNumArguments(currArgs, 3, "createPostWithImage");
        }

        // Trim All arguments:
        userId = await validateUserIdAndReturnTrimmedId(userId);
        content = await trimArguments([content]);
        content = content[0];
        if (imageUrl) {
            imageUrl = await trimArguments([imageUrl]);
            imageUrl = imageUrl[0];
        }

        // Set timestamp to current time 
        const timestamp = await getTodayDate();

        // Set comments, likes, dislikes to empty array
        const comments = [], likes = [], dislikes = [];

        // Create a new post object 
        const newPost = {
            userId: userId,
            content: content,
            imageUrl: imageUrl,
            timestamp: timestamp,
            comments: comments,
            likes: likes,
            dislikes: dislikes
        }

        // Add post to database
        const postCollection = await posts();
        const insertInfo = await postCollection.insertOne(newPost);
        if (!insertInfo.acknowledged || !insertInfo.insertedId)
            throw new Error('Could not add post');
        
        // Get ID and return user by getUserById
        const newId = insertInfo.insertedId.toString();
        const currPost = await exportedMethods.getPostById(newId);

        // Add postId to userId.posts array
        const newData = await userData.addPostToUser(userId, insertInfo.insertedId.toString())

        
        return newData;

    },
    getAllPosts: async () => {
        const postCollection = await posts();
        let postList = await postCollection.find({}).toArray();
        if (!postList) throw new Error('Could not get all users');
        postList = postList.map((element) => {
            element._id = element._id.toString();
            return element;
        });
        return postList;
    },
    getPostsByUserId: async (userId) => {
        const currUser = await userData.getUserById(userId);
        const currUserPosts = currUser.posts;
        const ans = []
        for (let i = 0; i < currUserPosts.length; i++) {
            const currPost = currUserPosts[i];
            ans.push(await exportedMethods.getPostById(currPost));
        }
        return ans;
    },
    // TODO: Populate function to remove post by Id
    removePost: async (postId) => {
        // Validate inputs 
        await checkInputsExistence([postId])
        await checkNumArguments([postId], 1, "removePostrById");
        await isStr(postId, "removePostById-postIdStr");
        postId = await validateUserIdAndReturnTrimmedId(postId);

        // Get post by Id
        const currPost = await exportedMethods.getPostById(postId);

        // Delete post from post database
        const postCollection = await posts();
        const deletionInfo = await postCollection.findOneAndDelete({
            _id: new ObjectId(postId)
        });
        // Validate that deletion was successful
        if (!deletionInfo) {
            throw new Error(`Could not delete movie with id of ${postId}`);
        }

        // Delete post from User database
        const userCollection = await users();
        userCollection.updateOne(
            { _id: new ObjectId(deletionInfo.userId) }, 
            { $pull: { posts: postId } } 
        );

        return { ...currPost, deleted: true };
    },
    // TODO: Determine what arguments are needed to update an existing post
    // TODO: Populate function to update post
    updatePost: async () => {
    },
    getPostById: async (postId) => {
        // Validate input 
        await checkInputsExistence([postId])
        await checkNumArguments([postId], 1, "getPostById");
        await isStr(postId, "getPostById-postIdStr");

        // Check that post ID is in database
        postId = await validateUserIdAndReturnTrimmedId(postId);

        // Get all posts and find post by id 
        const postCollection = await posts();
        const post = await postCollection.findOne({ _id: new ObjectId(postId) });

        // If post is not found, throw an error 
        if (post === null) throw new Error('No post with that id');

        // Convert post id to string and return post object
        post._id = post._id.toString();
        return post;
    },
    removePostsByUserId: async (userId) => {
        const posts = await exportedMethods.getPostsByUserId(userId);
        for (const post of posts) {
            exportedMethods.removePost(post._id);
        }
    }
}

export default exportedMethods;