const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["Admin", "User"], default: "User" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);

