const mongoose = require("mongoose");

const Meal = require("./meal").schema;

const Schema = mongoose.Schema;

const { DateTime } = require("luxon");

const PlanSchema = new Schema(
  {
    name: { type: String, required: true },
    meals: [Meal],
    user: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, toObject: true, toJSON: { virtuals: true } },
);

PlanSchema.virtual("createdAt_formatted").get(function () {
  return DateTime.fromJSDate(this.createdAt).toLocaleString(DateTime.DATE_MED);
});

PlanSchema.virtual("updatedAt_formatted").get(function () {
  return DateTime.fromJSDate(this.updatedAt).toLocaleString(DateTime.DATE_MED);
});

PlanSchema.virtual("totals").get(function () {
  let totcalories = 0;
  let totfats = 0;
  let totcarbs = 0;
  let totprot = 0;
  let totcost = 0;
  let totsat = 0;
  let totsug = 0;
  let totfibre = 0;
  let totsalt = 0;
  let meals = this.meals;
  for (const meal of meals) {
    let ingredients = meal.ingredients;
    for (const ingredient of ingredients) {
      totcalories += ingredient.calories;
      totfats += ingredient.fat * 9;
      totcarbs += ingredient.carbohydrate * 4;
      totprot += ingredient.protein * 4;
      totcost += ingredient.cost;
      totsat += ingredient.saturated;
      totsug += ingredient.sugars;
      totfibre += ingredient.fibre;
      totsalt += ingredient.salt;
    }
  }
  let percarbs = (totcarbs / totcalories) * 100;
  let perfats = (totfats / totcalories) * 100;
  let perprot = (totprot / totcalories) * 100;
  let info = {
    totalcal: totcalories,
    percarbs: percarbs,
    perfats: perfats,
    perprot: perprot,
    totalcost: totcost,
    totalcarbs: totcarbs,
    totalfats: totfats,
    totalprot: totprot,
    totalsat: totsat,
    totalsug: totsug,
    totalfibre: totfibre,
    totalsalt: totsalt,
  };
  return info;
});

module.exports = mongoose.model("Plan", PlanSchema);
