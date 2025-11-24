import mongoose from 'mongoose';

const userDataSchema = new mongoose.Schema({
    socketId: String,
    roomId: mongoose.Schema.Types.ObjectId,
    isActive: Boolean,
    userName: String,
    team: String,
    dateAndTime: Date,
    role: String,
    creationDateAndTime: Date,
    role: String
});

const createRoomSchema = new mongoose.Schema({
    isActive: Boolean,
    creationDateAndTime: Date,
    roomCode: Number,
    members: [userDataSchema]
},
{ collection: "roomData" }
);

export default mongoose.model("createRoom", createRoomSchema);
