const mongoose = require('mongoose')

const HelpSchema = new mongoose.Schema({
  location: { type: String, required: true },
  contact: { type: Number, required: true },
  about: { type: String },
  img: { url: { type: String, required: true }, publicId: { type: String } },
  created: { type: Date, default: Date.now },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' }

});

const UserSchema = new mongoose.Schema({
  user: { type: String, required: true, unique: true },
  name: { type: String, default: 'N/a' },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: "user" },
  address: { type: String, default: "N/a" },
  about: { type: String, default: "N/a" },
  gender: { type: String, default: 'N/a' },
  contact: { type: Number },
  volunteer: { type: Boolean, default: false },
  dob: { type: Date },

  avatar: {
    publicId: { type: String },
    url: { type: String, default: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQP-i5liksKo3g85Qz90jpYieJ4J_YGy5S7JQ&usqp=CAU' }
  },

  resetPasswordToken: String,
  resetPasswordExpire: Date
})

const HelpModel = mongoose.model("HelpModel", HelpSchema);
const UserModel = mongoose.model("UserModels", UserSchema);

module.exports = { HelpModel, UserModel }