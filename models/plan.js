const mongoose = require("mongoose");

const Meal = require;

const Schema = mongoose.Schema;

const PlanSchema = new Schema({
  meals: [Meal],
  user: { type: Schema.Types.ObjectId, ref: "User" },
  goal: { type: Number },
});

module.exports = mongoose.model("Plan", PlanSchema);
