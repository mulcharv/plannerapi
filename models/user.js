const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const UserSchema = new Schema({
    username: { type: String, required: true, unique: true, maxLength: 50},
    password: { type: String, required: true, maxLength: 100},
    watchlist: { type: Array }
});


module.exports = mongoose.model("User", UserSchema);