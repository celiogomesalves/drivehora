# Sons Exclusivos do DriveHora (Identidade Acústica)

Esta pasta armazena os arquivos de áudio originais da marca DriveHora. Se um arquivo estiver presente nesta pasta, o sistema reproduzirá o áudio real; se o arquivo não estiver presente, o sistema utiliza o sintetizador Web Audio API harmônico automaticamente.

## Arquivos Suportados:

1. **`new_ride.mp3`**:
   - **Quando toca**: Ao surgir uma nova corrida disponível para o motorista aceitar (o som característico que desperta a atenção, similar ao toque do Uber/99 ao tocar uma corrida).
   - **Duração recomendada**: 2 a 4 segundos.

2. **`accepted.mp3`**:
   - **Quando toca**: Para o passageiro quando o motorista aceita a corrida e se desloca até o embarque.
   - **Duração recomendada**: 1 a 2 segundos (tom positivo / confirmador).

3. **`in_progress.mp3`**:
   - **Quando toca**: Ao passageiro e motorista quando a viagem é iniciada.
   - **Duração recomendada**: 1 a 2 segundos.

4. **`finished.mp3`**:
   - **Quando toca**: Ao finalizar o trajeto com sucesso (acorde triunfal / conclusão).
   - **Duração recomendada**: 2 a 3 segundos.

5. **`alert.mp3`**:
   - **Quando toca**: Em avisos gerais, mensagens importantes do chat e notificações de sistema.

---

### Observação para Publicação em Aplicativo Nativo (Google Play & App Store):
Ao empacotar com Capacitor (Fase posterior), estes mesmos arquivos de áudio são inseridos na pasta nativa `android/app/src/main/res/raw/` e no bundle do iOS (`Xcode`), permitindo que as notificações Push e toques de corrida toquem o som exclusivo da marca **mesmo com a tela bloqueada ou com o celular no bolso**!
