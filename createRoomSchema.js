import mongoose from 'mongoose';


const createRoomSchema = new mongoose.Schema({
    isActive: Boolean,
    creationDateAndTime: Date,
    roomCode: Number,
},
{ collection: "roomData" }
);

export default mongoose.model("createRoom", createRoomSchema);
