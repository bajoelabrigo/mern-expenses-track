const jwt = require("jsonwebtoken");

const isAuthenticated = async (req, res, next) => {
  //!Get the token from the header
  const headerObj = req.headers;
  const token = headerObj?.authorization?.split(" ")[1];
  //!Verify the token
  const verifyToken = jwt.verify(token, "masynctechKey", (err, decoded) => {
    if (err) {
      return false;
    } else {
      return decoded; //?information of the user
    }
  });
  if(verifyToken){
    //!Save the user req obj
    req.user = verifyToken.id; //*id of the user ex:"67a7de0dd0c159d2e779675d"
    next()
  }else{
    const err = new Error("Token expired, login again")
    next(err)
  }
};

module.exports = isAuthenticated
