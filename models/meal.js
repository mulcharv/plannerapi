const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const Ingredient = require("./ingredient").schema;

const MealSchema = new Schema({
  name: { type: String },
  ingredients: [Ingredient],
  plan: { type: Schema.Types.ObjectId, ref: "Plan" },
  user: { type: Schema.Types.ObjectId, ref: "User" },
});

module.exports = mongoose.model("Meal", MealSchema);
