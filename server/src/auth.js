const jwt = require("jsonwebtoken");
function sign(user) {
  return jwt.sign({ sub:user.id, role:user.role, phone:user.phone },
    process.env.JWT_SECRET, { expiresIn:"30d" });
}
function auth(req,res,next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\\s+/i,"");
  if (!token) return res.status(401).json({error:"Մուտք գործեք հաշիվ"});
  try { req.user = jwt.verify(token,process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({error:"Մուտքի կոդը ժամկետանց է"}); }
}
function roles(...allowed) {
  return (req,res,next) => allowed.includes(req.user?.role)
    ? next() : res.status(403).json({error:"Թույլտվություն չկա"});
}
module.exports = {sign,auth,roles};
