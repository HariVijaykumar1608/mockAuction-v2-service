import mongoose from "mongoose";

const userDataSchema = new mongoose.Schema(
  {
    socketId: { type: String },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "createRoom" },
    isActive: { type: Boolean },
    userName: { type: String },
    team: { type: String },
    dateAndTime: { type: Date },
    role: { type: String },
    creationDateAndTime: { type: Date },
    gmailId : { type: String },
    password : { type: String }
  },
  { collection: "userData" }
);

export default mongoose.model("userData", userDataSchema);
