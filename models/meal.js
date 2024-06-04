const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const Ingredient = require("./ingredient").schema;

const MealSchema = new Schema(
  {
    name: { type: String },
    ingredients: [Ingredient],
    plan: { type: Schema.Types.ObjectId, ref: "Plan" },
    user: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { toObject: true, toJSON: { virtuals: true } },
);

MealSchema.virtual("totals").get(function () {
  let totcalories = 0;
  let ingredients = this.ingredients;
  for (const ingredient of ingredients) {
    totcalories += ingredient.calories;
  }
  return totcalories;
});

module.exports = mongoose.model("Meal", MealSchema);
