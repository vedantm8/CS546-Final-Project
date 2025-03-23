import { comments, users, posts } from "../config/mongoCollections.js";
import { checkInputsExistence, checkNumArguments, isStr, trimArguments, validateIdAndReturnTrimmedId, getTodayDate } from "../helpers.js";
import { userData, postData } from "./index.js";
import { ObjectId } from 'mongodb';

const exportedMethods = {
    createComment: async (postId, userId, text) => {
        // Validate arguments
        const currArgs = [postId, userId, text];
        // checks that inputs exist
        await checkInputsExistence(currArgs); 
        // check correct number of inputs
        await checkNumArguments(currArgs, 3, "createComment");
        // check that inputs are strings 
        await isStr(postId, "createComment-postId"); 
        await isStr(userId, "createCommetn-userId");
        await isStr(text, "createComment-text");
        // Checks that both ID inputs are valid
        await postData.getPostById(postId);
        await userData.getUserById(userId);

        // Trim the arguments
        const trimmedArgs = await trimArguments(currArgs);
        postId = trimmedArgs[0];
        userId = await validateIdAndReturnTrimmedId(userId);
        text = trimmedArgs[2];

        // Set timestamp to current time 
        const timestamp = await getTodayDate();

        const newComment = {
            postId: postId,
            userId: userId,
            text: text,
            timestamp: timestamp
        }

        // Add comment to collection
        const commentCollection = await comments();
        const insertInfo = await commentCollection.insertOne(newComment);
        if (!insertInfo.acknowledged || !insertInfo.insertedId)
            throw new Error('Could not add post');

        const commentId = insertInfo.insertedId.toString();
        const currComment = exportedMethods.getCommentById(commentId);

        // TODO: Add commentId to user.comments array
        await userData.addCommentToUser(userId, commentId);
        // TODO: Add commentId to post.comments array
        await postData.addCommentToPost(postId, commentId);
        
        return currComment;

    },
    getAllComments: async () => {
        const commentCollection = await comments();
        let commentList = await commentCollection.find({}).toArray();
        if (!commentList) throw new Error('Could not get all users');
        commentList = commentList.map((element) => {
            element._id = element._id.toString();
            return element;
        });
        return commentList;
    },
    getCommentById: async (commentId) => {
        // Validate input 
        await checkInputsExistence([commentId])
        await checkNumArguments([commentId], 1, "getCommentById");
        await isStr(commentId, "getCommentById-commentIdStr");

        // Check that comment ID is in database
        commentId = await validateIdAndReturnTrimmedId(commentId);

        // Get all comments and find comment by id 
        const commentCollection = await comments();
        const comment = await commentCollection.findOne({ _id: new ObjectId(commentId) });

        // If comment is not found, throw an error 
        if (comment === null) throw new Error('No comment with that id');

        // Convert comment id to string and return comment object
        comment._id = comment._id.toString();
        return comment;
    },
    removeComment: async (commentId) => {
        // Validate inputs 
        await checkInputsExistence([commentId])
        await checkNumArguments([commentId], 1, "removeCommentById");
        await isStr(commentId, "removeCommentById-commentIdStr");
        commentId = await validateIdAndReturnTrimmedId(commentId);

        // Get comment by Id
        const currPost = await exportedMethods.getCommentById(commentId);

        // Delete post from post database
        const commentCollection = await comments();
        const deletionInfo = await commentCollection.findOneAndDelete({
            _id: new ObjectId(currPost._id)
        });
        
        // Validate that deletion was successful
        if (!deletionInfo) {
            throw new Error(`Could not delete movie with id of ${postId}`);
        }

        // TODO: Delete comment from User database
        const userCollection = await users();
        userCollection.updateOne(
            { _id: new ObjectId(deletionInfo.userId) }, 
            { $pull: { comments: commentId } } 
        );

        // TODO: Delete comment from Post database
        const postCollection = await posts();
        postCollection.updateOne(
            { _id: new ObjectId(deletionInfo.postId) }, 
            { $pull: { comments: commentId } } 
        )

        return { ...currPost, deleted: true };
    },
    removeCommentsByUserId: async (userId) => {

    },
    removeCommentsByPostId: async (postId) => {

    }
}

export default exportedMethods;