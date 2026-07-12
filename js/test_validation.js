// TransitOps - Validation Rules Unit Tests
// Date Reference Context: July 12, 2026

const CURRENT_DATE = new Date("2026-07-12T09:45:00");

// Whitelist of valid manufacturer brands in the world
const VALID_BRANDS = [
  "tata", "mahindra", "bharatbenz", "ashok leyland", "eicher", "volvo",
  "scania", "isuzu", "toyota", "force", "maruti", "hyundai", "honda",
  "bajaj", "piaggio", "ford", "chevrolet", "tvs", "hero"
];

// Validation Engine copy from server.js/app.js for automated local testing
function validateVehicleData(data) {
  // 1. Model Brand Check
  const modelLower = (data.model || "").toLowerCase();
  const hasValidBrand = VALID_BRANDS.some(brand => modelLower.includes(brand));
  if (!hasValidBrand) {
    throw new Error(`Invalid manufacturer model '${data.model}'. Model name must contain a recognized brand.`);
  }

  // 2. Enum type check
  const validTypes = ["Truck", "Van", "Bus", "Trailer", "Cab", "Auto"];
  if (!validTypes.includes(data.type)) {
    throw new Error(`Invalid vehicle type '${data.type}'. Must be one of: Truck, Van, Bus, Trailer, Cab, Auto.`);
  }

  // 3. Expiry dates checks (insurance, fitness, permit must be post CURRENT_DATE July 12, 2026)
  const insDate = new Date(data.insuranceExpiry);
  const fitDate = new Date(data.fitnessExpiry);
  const permDate = new Date(data.permitExpiry);

  if (insDate < CURRENT_DATE) {
    throw new Error(`Insurance certificate is already expired (Expiry: ${data.insuranceExpiry}).`);
  }
  if (fitDate < CURRENT_DATE) {
    throw new Error(`Fitness certificate is already expired (Expiry: ${data.fitnessExpiry}).`);
  }
  if (permDate < CURRENT_DATE) {
    throw new Error(`State permit certificate is already expired (Expiry: ${data.permitExpiry}).`);
  }
}

function validateDriverData(data) {
  // 1. Name Check (Only letters/spaces, min 3 chars)
  const nameRegex = /^[a-zA-Z\s]{3,}$/;
  if (!nameRegex.test(data.name)) {
    throw new Error("Driver name must be at least 3 characters and contain only letters.");
  }

  // 2. License number standard formatting (8-16 alphanumeric characters)
  const dlRegex = /^[a-zA-Z0-9-]{8,16}$/;
  if (!dlRegex.test(data.licenseNumber.replace(/\s+/g, ""))) {
    throw new Error("Invalid driving license format. Must be 8-16 alphanumeric characters.");
  }

  // 3. Expiry date check
  const licDate = new Date(data.licenseExpiry);
  if (licDate < CURRENT_DATE) {
    throw new Error(`Driving license is already expired (Expiry: ${data.licenseExpiry}).`);
  }
}

// TEST RUNNER
let passedTests = 0;
let failedTests = 0;

function assertThrows(fn, expectedMessageSub, testName) {
  try {
    fn();
    failedTests++;
    console.error(`[\x1b[31mFAIL\x1b[0m] ${testName}: Expected validation error did not trigger.`);
  } catch (err) {
    if (err.message.includes(expectedMessageSub)) {
      passedTests++;
      console.log(`[\x1b[32mPASS\x1b[0m] ${testName}: Caught expected validation block: "${err.message}"`);
    } else {
      failedTests++;
      console.error(`[\x1b[31mFAIL\x1b[0m] ${testName}: Caught wrong error. Expected sub: "${expectedMessageSub}", got: "${err.message}"`);
    }
  }
}

function assertPasses(fn, testName) {
  try {
    fn();
    passedTests++;
    console.log(`[\x1b[32mPASS\x1b[0m] ${testName}: Validation succeeded as expected.`);
  } catch (err) {
    failedTests++;
    console.error(`[\x1b[31mFAIL\x1b[0m] ${testName}: Validation failed unexpectedly: "${err.message}"`);
  }
}

console.log("\n==============================================");
// Enforce date context
console.log(`   RUNNING TRANSITOPS STRICT VALIDATION TESTS`);
console.log(`   System Date Context: July 12, 2026`);
console.log("==============================================\n");

// VEHICLE VALIDATION TESTS

// 1. Valid Tata Truck
assertPasses(() => {
  validateVehicleData({
    model: "Tata Prima 4925",
    type: "Truck",
    insuranceExpiry: "2027-01-01",
    fitnessExpiry: "2027-01-01",
    permitExpiry: "2027-01-01"
  });
}, "Valid Tata Truck Onboarding");

// 2. Valid Toyota Cab
assertPasses(() => {
  validateVehicleData({
    model: "Toyota Innova Crysta",
    type: "Cab",
    insuranceExpiry: "2027-04-20",
    fitnessExpiry: "2027-04-15",
    permitExpiry: "2027-09-10"
  });
}, "Valid Toyota Cab Onboarding");

// 3. Valid Bajaj RE Auto-rickshaw
assertPasses(() => {
  validateVehicleData({
    model: "Bajaj RE Compact Auto",
    type: "Auto",
    insuranceExpiry: "2027-06-15",
    fitnessExpiry: "2027-05-10",
    permitExpiry: "2027-08-30"
  });
}, "Valid Bajaj Auto Onboarding");

// 4. Invalid Brand
assertThrows(() => {
  validateVehicleData({
    model: "FastWheels Roadster", // Non-whitelisted brand
    type: "Cab",
    insuranceExpiry: "2027-01-01",
    fitnessExpiry: "2027-01-01",
    permitExpiry: "2027-01-01"
  });
}, "recognized brand", "Reject Invalid Model Brands");

// 5. Expired Insurance
assertThrows(() => {
  validateVehicleData({
    model: "Toyota Prius",
    type: "Cab",
    insuranceExpiry: "2026-05-10", // EXPIRED relative to 2026-07-12
    fitnessExpiry: "2027-01-01",
    permitExpiry: "2027-01-01"
  });
}, "expired", "Reject Expired Vehicle Insurance");

// 6. Expired Fitness Certificate
assertThrows(() => {
  validateVehicleData({
    model: "Mahindra Bolero",
    type: "Van",
    insuranceExpiry: "2027-01-01",
    fitnessExpiry: "2026-07-10", // EXPIRED relative to 2026-07-12
    permitExpiry: "2027-01-01"
  });
}, "expired", "Reject Expired Vehicle Fitness");

// DRIVER VALIDATION TESTS

// 7. Valid Driver Profile
assertPasses(() => {
  validateDriverData({
    name: "John Doe",
    licenseNumber: "DL-142018009941",
    licenseExpiry: "2028-09-12"
  });
}, "Valid Driver Profile Onboarding");

// 8. Reject short name
assertThrows(() => {
  validateDriverData({
    name: "Jo", // Too short (min 3)
    licenseNumber: "DL-142018009941",
    licenseExpiry: "2028-09-12"
  });
}, "name must be at least 3 characters", "Reject Short Driver Names");

// 9. Reject invalid symbols in name
assertThrows(() => {
  validateDriverData({
    name: "John D0e!", // Numbers and symbols not allowed
    licenseNumber: "DL-142018009941",
    licenseExpiry: "2028-09-12"
  });
}, "name must be at least 3 characters", "Reject Numeric Characters in Name");

// 10. Reject invalid License Formatting
assertThrows(() => {
  validateDriverData({
    name: "Johnathan Doe",
    licenseNumber: "DL-12", // Too short (min 8 characters)
    licenseExpiry: "2028-09-12"
  });
}, "Invalid driving license format", "Reject Short Driving Licenses");

// 11. Reject Expired Licenses
assertThrows(() => {
  validateDriverData({
    name: "Johnathan Doe",
    licenseNumber: "DL-142018009941",
    licenseExpiry: "2026-06-30" // EXPIRED relative to July 12, 2026
  });
}, "expired", "Reject Expired Driver Licenses");


console.log("\n==============================================");
console.log(`   TEST SUMMARY: ${passedTests} Passed, ${failedTests} Failed`);
console.log("==============================================\n");

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
