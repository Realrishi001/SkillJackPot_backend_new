import Admin from "../models/admins.model.js";

export const blockOrUnblockShop = async (req, res) => {
  try {
    const { shopId, duration } = req.body;

    if (!shopId || duration === undefined) {
      return res.status(400).json({ message: "shopId and duration are required" });
    }

    const admin = await Admin.findByPk(shopId);
    if (!admin) {
      return res.status(404).json({ message: "Shop not found" });
    }

    // If already blocked → UNBLOCK
    if (admin.blockStatus === true || admin.blockStatus === 1) {
      admin.blockStatus = 0;
      admin.blockTill = null;
      await admin.save();

      return res.status(200).json({
        message: "Shop unblocked successfully",
        shopId: admin.id,
        blockStatus: admin.blockStatus,
        blockTill: admin.blockTill
      });
    }

    // If not blocked → BLOCK SHOP
    let days = Number(duration);
    const blockTill = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    admin.blockStatus = 1;
    admin.blockTill = blockTill;
    await admin.save();

    return res.status(200).json({
      message: "Shop blocked successfully",
      shopId: admin.id,
      blockStatus: admin.blockStatus,
      blockTill: admin.blockTill
    });

  } catch (error) {
    console.log("BLOCK ERROR:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
};


export const getAdminsBlockStatus = async (req, res) => {
  try {
    const admins = await Admin.findAll({
      attributes: [
        "id",
        "shopName",
        "userName",
        "blockStatus",
        "blockTill"
      ]
    });

    return res.status(200).json({
      count: admins.length,
      admins
    });

  } catch (error) {
    console.log("GET BLOCK ERROR:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
};


export const getSingleAdminBlockStatus = async (req, res) => {
  try {
    const { adminId } = req.body;

    if (!adminId) {
      return res.status(400).json({
        message: "adminId is required"
      });
    }

    const admin = await Admin.findOne({
      where: { id: adminId },
      attributes: ["id", "shopName", "userName", "blockStatus", "blockTill"]
    });

    if (!admin) {
      return res.status(404).json({
        message: "Admin not found"
      });
    }

    // Compute duration in days if blocked
    let duration = null;
    if (admin.blockStatus && admin.blockTill) {
      const now = new Date();
      const till = new Date(admin.blockTill);
      const diffMs = till - now;

      duration = Math.ceil(diffMs / (1000 * 60 * 60 * 24)); // days
      if (duration < 0) duration = 0;
    }

    return res.status(200).json({
      message: "Admin block status fetched successfully",
      data: {
        id: admin.id,
        shopName: admin.shopName,
        userName: admin.userName,
        blockStatus: admin.blockStatus,
        blockTill: admin.blockTill,
        duration
      }
    });

  } catch (error) {
    console.error("GET SINGLE BLOCK ERROR:", error);
    return res.status(500).json({
      message: "Internal server error",
      error
    });
  }
};
