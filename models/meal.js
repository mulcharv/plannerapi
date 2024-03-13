const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const Ingredient = require("./ingredient").schema;

const MealSchema = new Schema({
  name: { type: String },
  ingredients: [Ingredient],
  user: { type: Schema.Types.ObjectId, ref: "User" },
});

module.exports = mongoose.model("Meal", MealSchema);
