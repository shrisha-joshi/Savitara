// MongoDB replica-set initialise script
// Mounted into /docker-entrypoint-initdb.d/ — runs once on first start
// Enables atomic multi-document transactions required by the booking flow.

rs.initiate({
  _id: "rs0",
  members: [{ _id: 0, host: "mongodb:27017" }],
});

// Wait until the node becomes primary before creating indexes
let attempts = 0;
while (rs.status().myState !== 1 && attempts < 30) {
  sleep(1000);
  attempts++;
}

print("Replica set initialised. Primary is ready.");
