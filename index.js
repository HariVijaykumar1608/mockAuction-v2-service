import { createServer } from "http";
import { Server } from "socket.io";
import { customAlphabet } from "nanoid";
import { mongodbFunctions } from "./mongoDbFunctions.js";
import CreateRoom from "./createRoomSchema.js";
import UserData from "./userDataSchema.js";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import dotenv from "dotenv";
dotenv.config();

const JWT_SECRET = "Dasarp_irah";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

mongodbFunctions.connectDb()
  .then(() => console.log("DB Connected"))
  .catch((err) => console.error("DB Error:", err));


// -------------------------------
// POST: /signIn
// -------------------------------
app.post("/signIn", async (req, res) => {
  const { userName, gmailId, password } = req.body;

  if (!userName || !gmailId || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const date = new Date().toISOString();

  try {
    const newUser = await UserData.create({
      userName,
      gmailId,
      password,
      isActive: true,
      dateAndTime: date,
    });

    res.status(201).json({
      message: "User signed in successfully",
      data: newUser.toObject(),
    });
  } catch (err) {
    res.status(400).json({ message: "Database Error", error: err });
  }
});


// -------------------------------
// POST: /login
// -------------------------------
app.post("/login", async (req, res) => {
  const { gmailId, password } = req.body;

  if (!gmailId || !password) {
    return res.status(400).json({ message: "Both fields required" });
  }

  const user = await UserData.findOne({ gmailId });

  if (!user) {
    return res.status(400).json({ message: "User not found" });
  }

  const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
    expiresIn: "24h",
  });

  res.cookie("userId", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    message: "Login successful",
    data: { userId: user._id, userName: user.userName },
  });
});

app.get("/check-login", async (req, res) => {
  const token = req.cookies.userId;

  if (!token) {
    return res.status(401).json({ message: "No token found" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId
    const user = await UserData.findOne({ _id: userId });
    if (user.isActive) {
      return res.status(200).json({
        message: "Auto login success",
        data: { userId: decoded.userId, userName: user.userName }
      });
    }
    else{
      return res.status(401).json({ message: "inActive user" });
    }

  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
})


// -------------------------------
// SOCKET.IO SETUP
// -------------------------------
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});


// AUTH MIDDLEWARE FOR SOCKETS
io.use((socket, next) => {
  try {
    const cookies = cookie.parse(socket.handshake.headers.cookie || "");
    const token = cookies.userId;

    if (!token) return next(new Error("No auth token"));

    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId;

    next();
  } catch (err) {
    next(new Error("Invalid Token"));
  }
});


// socketId → roomCode
const userRoomMap = {};


// -------------------------------
// SOCKET CONNECTION
// -------------------------------
io.on("connection", (socket) => {
  console.log("Connected:", socket.userId);


  // CREATE ROOM
  socket.on("create-room", async (data) => {
    const { userName, team } = data;
    const roomCode = customAlphabet("0123456789", 4)();
    const date = new Date().toISOString();

    const roomObj = {
      isActive: true,
      creationDateAndTime: date,
      roomCode,
    };

    const createRoom = await CreateRoom.create(roomObj);

    const userObj = {
      roomId: createRoom._id,
      userName,
      team,
      role: "creator",
      isActive: true,
      dateAndTime: date,
    };

    const createdUser = await UserData.create(userObj);

    socket.join(roomCode);
    userRoomMap[socket.id] = roomCode;

    socket.emit("room-created", roomCode);
    socket.emit("userDetails", createdUser.toObject());

    const members = await UserData.find({ roomId: createRoom._id });
    io.to(roomCode).emit("getAllRoomMembers", members.map(m => m.toObject()));
  });



  // JOIN ROOM
  socket.on("join-room", async (data) => {
    const { roomCode, team, userName } = data;

    const room = await CreateRoom.findOne({ roomCode });
    if (!room) {
      return socket.emit("joinRoomErrorHandling", { msg: "Room not found" });
    }

    const existingUsers = await UserData.find({ roomId: room._id });

    if (existingUsers.some(u => u.team === team)) {
      return socket.emit("joinRoomErrorHandling", {
        msg: "Team already taken",
        option: ["CSK", "MI", "RCB", "KKR", "GT", "LSG", "SRH", "PBKS", "RR", "DC"]
          .filter(t => t !== team),
      });
    }

    const date = new Date().toISOString();

    const newUser = await UserData.create({
      roomId: room._id,
      userName,
      team,
      role: "member",
      isActive: true,
      dateAndTime: date,
    });

    socket.join(roomCode);
    userRoomMap[socket.id] = roomCode;

    socket.emit("joined-room", roomCode);
    socket.emit("userDetails", newUser.toObject());

    const members = await UserData.find({ roomId: room._id });
    io.to(roomCode).emit("getAllRoomMembers", members.map(m => m.toObject()));
  });



  // START AUCTION
  socket.on("startAuction", ({ roomCode, timer }) => {
    io.to(roomCode).emit("auctionStarted", timer);
  });



  // DISCONNECT
  socket.on("disconnect", async () => {
    const roomCode = userRoomMap[socket.id];
    if (!roomCode) return;

    const room = await CreateRoom.findOne({ roomCode });
    if (!room) return;

    // const user = await UserData.findOne({ _id: socket.userId });
    // if (user) {
    //   user.isActive = false;
    //   await user.save();
    // }

    const members = await UserData.find({ roomId: room._id });
    io.to(roomCode).emit("getAllRoomMembers", members.map(m => m.toObject()));

    delete userRoomMap[socket.id];
  });
});


httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
