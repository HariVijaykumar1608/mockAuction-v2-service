import mongoose from 'mongoose';


export const mongodbFunctions = {
    connectDb: async () => {
        const response = await mongoose.connect(process.env.mongoDb_Url);
        return response
    }
}