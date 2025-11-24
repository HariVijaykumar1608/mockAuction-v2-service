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
},{ collection: "userData" });


export default mongoose.model("userData", userDataSchema);
