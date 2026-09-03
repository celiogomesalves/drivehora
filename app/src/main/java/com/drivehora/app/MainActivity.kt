package com.drivehora.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import java.util.UUID

data class RideRequest(
    val id: String = "",
    val clientId: String = "",
    val origin: String = "",
    val destination: String = "",
    val hours: Int = 1,
    val hourlyRate: Double = 50.0,
    val status: String = "searching"
) {
    val total: Double get() = hours * hourlyRate
    val commission: Double get() = total * 0.15
    val driverNet: Double get() = total * 0.85
}

class MainActivity : ComponentActivity() {
    private val auth by lazy { FirebaseAuth.getInstance() }
    private val db by lazy { FirebaseFirestore.getInstance() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (auth.currentUser == null) auth.signInAnonymously()
        setContent { DriveHoraApp(db, auth) }
    }
}

@Composable
fun DriveHoraApp(db: FirebaseFirestore, auth: FirebaseAuth) {
    var role by remember { mutableStateOf<String?>(null) }

    MaterialTheme {
        Surface(Modifier.fillMaxSize()) {
            if (role == null) RoleScreen { role = it }
            else if (role == "client") ClientScreen(db, auth)
            else DriverScreen(db, auth)
        }
    }
}

@Composable
fun RoleScreen(onRole: (String) -> Unit) {
    Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("DriveHora", style = MaterialTheme.typography.headlineLarge)
        Text("Motorista por hora • Comissão do app: 15%")
        Spacer(Modifier.height(16.dp))
        Button(onClick = { onRole("client") }, Modifier.fillMaxWidth()) { Text("Sou cliente") }
        OutlinedButton(onClick = { onRole("driver") }, Modifier.fillMaxWidth()) { Text("Sou motorista") }
    }
}

@Composable
fun ClientScreen(db: FirebaseFirestore, auth: FirebaseAuth) {
    var origin by remember { mutableStateOf("") }
    var destination by remember { mutableStateOf("") }
    var hours by remember { mutableStateOf("1") }
    var rate by remember { mutableStateOf("50") }
    var message by remember { mutableStateOf("") }

    val h = hours.toIntOrNull()?.coerceIn(1, 24) ?: 1
    val r = rate.toDoubleOrNull()?.coerceAtLeast(0.0) ?: 50.0
    val total = h * r
    val commission = total * 0.15
    val driverNet = total * 0.85

    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Solicitar motorista", style = MaterialTheme.typography.headlineSmall)
        OutlinedTextField(origin, { origin = it }, label = { Text("Endereço de partida") }, Modifier.fillMaxWidth())
        OutlinedTextField(destination, { destination = it }, label = { Text("Endereço de destino") }, Modifier.fillMaxWidth())
        OutlinedTextField(hours, { hours = it.filter(Char::isDigit) }, label = { Text("Horas (1–24)") }, Modifier.fillMaxWidth())
        OutlinedTextField(rate, { rate = it }, label = { Text("Valor por hora (R$)") }, Modifier.fillMaxWidth())

        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Text("Total: R$ %.2f".format(total))
                Text("Comissão DriveHora (15%): R$ %.2f".format(commission))
                Text("Repasse estimado ao motorista: R$ %.2f".format(driverNet))
            }
        }

        Button(
            enabled = origin.isNotBlank() && destination.isNotBlank(),
            onClick = {
                val id = UUID.randomUUID().toString()
                val request = mapOf(
                    "id" to id,
                    "clientId" to (auth.currentUser?.uid ?: ""),
                    "origin" to origin,
                    "destination" to destination,
                    "hours" to h,
                    "hourlyRate" to r,
                    "total" to total,
                    "commission" to commission,
                    "driverNet" to driverNet,
                    "status" to "searching",
                    "createdAt" to System.currentTimeMillis()
                )
                db.collection("rideRequests").document(id).set(request)
                    .addOnSuccessListener { message = "Solicitação enviada. Procurando motorista..." }
                    .addOnFailureListener { message = "Erro: ${it.message}" }
            },
            Modifier.fillMaxWidth()
        ) { Text("Solicitar motorista") }

        if (message.isNotBlank()) Text(message)
    }
}

@Composable
fun DriverScreen(db: FirebaseFirestore, auth: FirebaseAuth) {
    var online by remember { mutableStateOf(false) }
    var requests by remember { mutableStateOf(listOf<Map<String, Any>>()) }

    LaunchedEffect(online) {
        if (!online) { requests = emptyList(); return@LaunchedEffect }
        db.collection("rideRequests").whereEqualTo("status", "searching")
            .addSnapshotListener { snap, _ ->
                requests = snap?.documents?.mapNotNull { it.data } ?: emptyList()
            }
    }

    Column(Modifier.padding(20.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Painel do motorista", style = MaterialTheme.typography.headlineSmall)
            Switch(checked = online, onCheckedChange = { online = it })
        }
        Text(if (online) "ONLINE — recebendo solicitações" else "OFFLINE")
        Spacer(Modifier.height(12.dp))

        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(requests) { r ->
                val id = r["id"]?.toString() ?: return@items
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Partida: ${r["origin"]}")
                        Text("Destino: ${r["destination"]}")
                        Text("Horas: ${r["hours"]}")
                        Text("Total: R$ %.2f".format((r["total"] as? Number)?.toDouble() ?: 0.0))
                        Button(onClick = {
                            db.collection("rideRequests").document(id).update(
                                mapOf(
                                    "status" to "accepted",
                                    "driverId" to (auth.currentUser?.uid ?: "")
                                )
                            )
                        }) { Text("Aceitar") }
                    }
                }
            }
        }
    }
}
