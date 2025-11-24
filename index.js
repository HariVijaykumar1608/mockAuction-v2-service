import { createServer } from "http";
import { Server } from "socket.io";
import { customAlphabet } from "nanoid";
import { mongodbFunctions } from "./mongoDbFunctions.js";
import CreateRoom from "./createRoomSchema.js"
import UserData from "./userDataSchema.js";

import dotenv from "dotenv";
dotenv.config();

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

async function startServer() {
  mongodbFunctions.connectDb()
    .then(() => console.log("DB Connected"))
    .catch(err => console.error("DB Connection Error:", err));
}

startServer();

// Store members in each room
let roomData = [];

// Quick lookup: socketId → roomCode
const userRoomMap = {};

io.on("connection", (socket) => {
  socket.on("create-room", async (userData) => {
    const date = new Date().toISOString()
    const nanoid = customAlphabet('0123456789', 4);
    const roomCode = nanoid();

    socket.join(roomCode);


    const userObj = {
      socketId: socket.id,
      isActive: true,
      userName: userData.userName,
      team: userData.team,
      dateAndTime: date,
      role: "creator"
    }
    const roomObj = {
      isActive: true,
      creationDateAndTime: date,
      roomCode
    }

    let addUser
    try {
      const createRoom = await CreateRoom.create(roomObj)
      addUser = await UserData.create({ ...userObj, roomId: createRoom._id })
    }
    catch (error) {
      console.error(error)
      throw error
    }
    userRoomMap[socket.id] = roomCode;
    socket.emit("room-created", roomCode);
    socket.emit("userDetails", addUser.toObject())  // converting BSON to JSON other wise it will throw error
    socket.emit("getAllRoomMembers", [addUser.toObject()]);
  });

  socket.on("join-room", async (userData) => {
    const date = new Date().toISOString()
    const options = [
      "CSK", "MI", "RCB", "KKR", "GT", "LSG", "SRH", "PBKS", "RR", "DC"
    ];
    const { roomCode, team, userName } = userData;

    const roomId = await CreateRoom.findOne({ roomCode: roomCode },{_id:true})
    const roomInfo = await UserData.find({roomId : roomId._id}) || []


    if (roomInfo) {
      const teamExists = roomInfo.some((obj) => obj.team === team);

      if (teamExists) {
        let response = {
          msg: "Selected team has already been taken!!",
          option: options.filter((name) => name !== team),
        };
        socket.emit("joinRoomErrorHandling", response);
      } else {
        const userObj = {
          socketId: socket.id,
          roomId: roomId._id,
          isActive: true,
          userName,
          team,
          dateAndTime: date,
          role: "member",
        };

        const addUser = await UserData.create(userObj)
        socket.join(roomCode);
        userRoomMap[socket.id] = roomCode;
        socket.emit("joined-room", roomCode);
        socket.emit("userDetails", addUser.toObject());
        const roomMembers = await UserData.find({roomId : roomId._id}) || []
        const plainMembers = roomMembers.map(obj => obj.toObject());
        io.to(roomCode).emit("getAllRoomMembers", plainMembers || []);
      }
    }
  });


  socket.on("startAuction", (props) => {
    const { roomCode, timer } = props
    io.to(roomCode).emit("auctionStarted", timer);

  })

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    const roomCode = userRoomMap[socket.id];
    if (!roomCode) return;

    const users = roomData[roomCode];
    if (!users) return;

    const userIndex = users.findIndex((u) => u._id === socket.id);
    if (userIndex !== -1) {
      roomData[roomCode][userIndex].isActive = false;
      io.to(roomCode).emit("getAllRoomMembers", roomData[roomCode]);
    }

    // cleanup mapping
    delete userRoomMap[socket.id];
  });
});

httpServer.listen(3000, () => {
  console.log("Server is running");
});
