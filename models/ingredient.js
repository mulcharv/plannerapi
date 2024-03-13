const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const IngredientSchema = new Schema({
  name: { type: String, required: true },
  calories: { type: Number, required: true },
  fat: { type: Number, required: true },
  saturated: { type: Number, required: true },
  carbohydrate: { type: Number, required: true },
  sugars: { type: Number, required: true },
  fibre: { type: Number, required: true },
  protein: { type: Number, required: true },
  salt: { type: Number, required: true },
  cost: { type: Number, required: true },
  quantity: { type: Number, required: true },
  meal: { type: Schema.Types.ObjectId, ref: "Meal" },
  size: { type: String, required: true },
});

module.exports = mongoose.model("Ingredient", IngredientSchema);
