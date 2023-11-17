const compression = require("compression");
const express = require("express");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.use(compression());
app.get("/", (req, res) => {
  res.status(200).json({ message: "Response returned successfully" });
});
app.post("/api/v1/split-payments/compute", (req, res) => {
  try {
    const { ID, Amount, SplitInfo } = req.body;
    let balance = Amount;
    const splitBreakdown = [];
    if (SplitInfo.length > 20)
      throw new Error("Can only contain maximum of 20 entries");
    if (SplitInfo.length < 1)
      throw new Error("Can only contain minimum of 1 entry");
    // Sorting SplitInfo based on precedence rules
    const sortedSplitInfo = SplitInfo.sort((a, b) => {
      const precedenceOrder = { FLAT: 1, PERCENTAGE: 2, RATIO: 3 };
      return precedenceOrder[a.SplitType] - precedenceOrder[b.SplitType];
    });
    let isRatio = false;
    let openingRatioBalance;
    for (const splitEntity of sortedSplitInfo) {
      let splitAmount = 0;
      if (splitEntity.SplitType === "FLAT") {
        splitAmount = splitEntity.SplitValue;
        // Update the balance for the next iteration
        // Check constraints
      } else if (splitEntity.SplitType === "PERCENTAGE") {
        splitAmount = (splitEntity.SplitValue / 100) * balance;
        // Update the balance for the next iteration
        // Check constraints
      } else if (splitEntity.SplitType === "RATIO") {
        // Calculate the total ratio sum

        if (!isRatio) {
          isRatio = true;
          openingRatioBalance = balance;
        }
        const totalRatio = SplitInfo.filter(
          (s) => s.SplitType === "RATIO"
        ).reduce((sum, s) => sum + s.SplitValue, 0);
        // Calculate the split amount based on the ratio
        splitAmount =
          (splitEntity.SplitValue / totalRatio) * openingRatioBalance;
        // Check constraints
      }

      if (splitAmount < 0 || splitAmount > Amount || splitAmount > balance) {
        throw new Error("Invalid split amount");
      }
      splitBreakdown.push({
        SplitEntityId: splitEntity.SplitEntityId,
        Amount: splitAmount,
      });

      //   // Update the balance for the next iteration
      balance -= splitAmount;
    }

    if (balance < 0) {
      throw new Error("Final balance cannot be less than 0");
    }

    const response = {
      ID,
      Balance: balance, // Rounding to 2 decimal places
      SplitBreakdown: splitBreakdown,
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
