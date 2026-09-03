import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";

dotenv.config();

let useFirestore = false;
let db: admin.firestore.Firestore | null = null;

try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
  }
  db = admin.firestore();
  useFirestore = true;
  console.log("Firebase Admin inicializado com sucesso.");
} catch (err: any) {
  console.warn("Aviso: Firebase Admin sem credenciais ativas. Rodando em modo de memória local (desenvolvimento).", err?.message);
  useFirestore = false;
}

// Armazenamento em memória (fallback)
interface Ride {
  id: string;
  clientId: string;
  driverId?: string;
  origin: string;
  destination: string;
  hours: number;
  hourlyRate: number;
  total: number;
  commission: number;
  driverNet: number;
  status: "searching" | "accepted" | "in_progress" | "finished" | "cancelled";
  createdAt: number;
  acceptedAt?: number;
  startedAt?: number;
  finishedAt?: number;
}

const memoryRides: Map<string, Ride> = new Map();

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const COMMISSION = 0.15;

app.get("/health", (_, res) => {
  res.json({
    ok: true,
    service: "DriveHora API",
    mode: useFirestore ? "firebase-firestore" : "local-memory",
    activeRides: memoryRides.size
  });
});

// Cotação
app.post("/rides/quote", (req, res) => {
  const hours = Math.max(1, Math.min(24, Number(req.body.hours || 1)));
  const hourlyRate = Math.max(0, Number(req.body.hourlyRate || 50));
  const total = hours * hourlyRate;
  res.json({
    hours,
    hourlyRate,
    total,
    commission: Number((total * COMMISSION).toFixed(2)),
    driverNet: Number((total * (1 - COMMISSION)).toFixed(2))
  });
});

// Listar todas as corridas ou filtrar por status/driverId/clientId
app.get("/rides", async (req, res) => {
  const { status, clientId, driverId } = req.query;

  if (useFirestore && db) {
    try {
      let query: admin.firestore.Query = db.collection("rideRequests");
      if (status) query = query.where("status", "==", status);
      if (clientId) query = query.where("clientId", "==", clientId);
      if (driverId) query = query.where("driverId", "==", driverId);

      const snapshot = await query.orderBy("createdAt", "desc").limit(50).get();
      const rides = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return res.json(rides);
    } catch (e: any) {
      console.warn("Erro ao buscar no Firestore, alternando para memória:", e?.message);
    }
  }

  let list = Array.from(memoryRides.values()).sort((a, b) => b.createdAt - a.createdAt);
  if (status) list = list.filter(r => r.status === status);
  if (clientId) list = list.filter(r => r.clientId === clientId);
  if (driverId) list = list.filter(r => r.driverId === driverId);

  res.json(list);
});

// Obter corrida específica
app.get("/rides/:id", async (req, res) => {
  const id = req.params.id;
  if (useFirestore && db) {
    try {
      const doc = await db.collection("rideRequests").doc(id).get();
      if (doc.exists) {
        return res.json({ id: doc.id, ...doc.data() });
      }
    } catch (e) {}
  }
  const ride = memoryRides.get(id);
  if (!ride) return res.status(404).json({ error: "Corrida não encontrada" });
  res.json(ride);
});

// Criar solicitação de corrida
app.post("/rides", async (req, res) => {
  const { clientId, origin, destination, hours, hourlyRate } = req.body;
  if (!clientId || !origin || !destination) {
    return res.status(400).json({ error: "clientId, origin e destination são obrigatórios" });
  }

  const h = Math.max(1, Math.min(24, Number(hours || 1)));
  const rate = Math.max(0, Number(hourlyRate || 50));
  const total = Number((h * rate).toFixed(2));
  const commission = Number((total * COMMISSION).toFixed(2));
  const driverNet = Number((total * (1 - COMMISSION)).toFixed(2));
  const id = "ride_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

  const newRide: Ride = {
    id,
    clientId,
    origin,
    destination,
    hours: h,
    hourlyRate: rate,
    total,
    commission,
    driverNet,
    status: "searching",
    createdAt: Date.now()
  };

  memoryRides.set(id, newRide);

  if (useFirestore && db) {
    try {
      await db.collection("rideRequests").doc(id).set({
        ...newRide,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (e: any) {
      console.warn("Não foi possível salvar no Firestore:", e?.message);
    }
  }

  res.status(201).json(newRide);
});

// Aceitar corrida (motorista)
app.post("/rides/:id/accept", async (req, res) => {
  const { driverId } = req.body;
  const id = req.params.id;
  if (!driverId) return res.status(400).json({ error: "driverId obrigatório" });

  const ride = memoryRides.get(id);
  if (ride) {
    ride.status = "accepted";
    ride.driverId = driverId;
    ride.acceptedAt = Date.now();
    memoryRides.set(id, ride);
  }

  if (useFirestore && db) {
    try {
      await db.collection("rideRequests").doc(id).update({
        driverId,
        status: "accepted",
        acceptedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (e: any) {}
  }

  res.json({ ok: true, ride: memoryRides.get(id) });
});

// Iniciar corrida
app.post("/rides/:id/start", async (req, res) => {
  const id = req.params.id;
  const ride = memoryRides.get(id);
  if (ride) {
    ride.status = "in_progress";
    ride.startedAt = Date.now();
    memoryRides.set(id, ride);
  }

  if (useFirestore && db) {
    try {
      await db.collection("rideRequests").doc(id).update({
        status: "in_progress",
        startedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (e: any) {}
  }

  res.json({ ok: true, ride: memoryRides.get(id) });
});

// Finalizar corrida
app.post("/rides/:id/finish", async (req, res) => {
  const id = req.params.id;
  const ride = memoryRides.get(id);
  if (ride) {
    ride.status = "finished";
    ride.finishedAt = Date.now();
    memoryRides.set(id, ride);
  }

  if (useFirestore && db) {
    try {
      await db.collection("rideRequests").doc(id).update({
        status: "finished",
        finishedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (e: any) {}
  }

  res.json({ ok: true, ride: memoryRides.get(id) });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 DriveHora API rodando em http://localhost:${PORT} e acessível na rede local em porta ${PORT}`);
});
