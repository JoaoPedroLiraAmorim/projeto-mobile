import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { db } from "./firebase";

// ============================================================================
// 1. ENTIDADE: USUÁRIOS
// Mapeamento: Coleção 'usuarios'
// ============================================================================
export const usuariosService = {
  async salvarUsuario(uid, dados) {
    const docRef = doc(db, "usuarios", uid);
    const payload = {
      nome: dados.nome?.trim() || "",
      email: dados.email?.trim().toLowerCase() || "",
      cargo: dados.cargo || "aluno",
      status: dados.status || "ativo",
      updatedAt: serverTimestamp()
    };
    await setDoc(docRef, payload, { merge: true });
    return { id: uid, ...payload };
  },

  async obterUsuario(uid) {
    const docSnap = await getDoc(doc(db, "usuarios", uid));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  },

  listarUsuarios(callback) {
    const q = query(collection(db, "usuarios"));
    return onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(lista);
    });
  }
};

// ============================================================================
// 2. ENTIDADE: NOTEBOOKS
// Mapeamento: Coleção 'notebooks'
// ============================================================================
export const notebooksService = {
  async cadastrarNotebook(dados) {
    if (!dados.patrimonio?.trim()) {
      throw new Error("O patrimônio do notebook é obrigatório.");
    }
    const payload = {
      patrimonio: dados.patrimonio.trim().toUpperCase(),
      marca: dados.marca?.trim() || "",
      modelo: dados.modelo?.trim() || "",
      status: dados.status || "disponivel", // "disponivel" | "em_uso" | "manutencao"
      observacoes: dados.observacoes?.trim() || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const ref = await addDoc(collection(db, "notebooks"), payload);
    return { id: ref.id, ...payload };
  },

  async atualizarStatus(notebookId, novoStatus) {
    await updateDoc(doc(db, "notebooks", notebookId), {
      status: novoStatus,
      updatedAt: serverTimestamp()
    });
  },

  async excluirNotebook(notebookId) {
    await deleteDoc(doc(db, "notebooks", notebookId));
  },

  listarNotebooks(callback) {
    const q = query(collection(db, "notebooks"));
    return onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      lista.sort((a, b) => (a.patrimonio || "").localeCompare(b.patrimonio || ""));
      callback(lista);
    });
  }
};

// ============================================================================
// 3. ENTIDADE: RESERVAS
// Mapeamento: Coleção 'reservas' com validação de conflito de horários
// ============================================================================
export const reservasService = {
  /**
   * Verifica se há sobreposição de horário para o notebook solicitado.
   * Regra: Dois intervalos [A_inicio, A_fim] e [B_inicio, B_fim] conflitam se
   * A_inicio < B_fim E A_fim > B_inicio.
   */
  async verificarConflito(notebookId, inicioIso, fimIso, reservaIdIgnorar = null) {
    const novoInicio = new Date(inicioIso).getTime();
    const novoFim = new Date(fimIso).getTime();

    if (isNaN(novoInicio) || isNaN(novoFim) || novoInicio >= novoFim) {
      throw new Error("O horário de início deve ser anterior ao horário de término.");
    }

    const q = query(
      collection(db, "reservas"),
      where("notebookId", "==", notebookId),
      where("status", "==", "confirmada")
    );

    const snapshot = await getDocs(q);
    for (const d of snapshot.docs) {
      if (reservaIdIgnorar && d.id === reservaIdIgnorar) continue;
      const r = d.data();
      const rInicio = new Date(r.dataInicio).getTime();
      const rFim = new Date(r.dataFim).getTime();

      if (novoInicio < rFim && novoFim > rInicio) {
        return {
          conflito: true,
          reservaConflitante: { id: d.id, ...r }
        };
      }
    }
    return { conflito: false };
  },

  async criarReserva({ notebookId, notebookPatrimonio, usuarioId, usuarioNome, dataInicio, dataFim, finalidade }) {
    if (!notebookId || !usuarioId || !dataInicio || !dataFim) {
      throw new Error("Notebook, usuário e datas são obrigatórios para a reserva.");
    }

    // Validação de conflito antes de salvar
    const checagem = await this.verificarConflito(notebookId, dataInicio, dataFim);
    if (checagem.conflito) {
      const c = checagem.reservaConflitante;
      const inicioFormatado = new Date(c.dataInicio).toLocaleString("pt-BR");
      const fimFormatado = new Date(c.dataFim).toLocaleString("pt-BR");
      throw new Error(
        `Conflito de horário! Este notebook já está reservado por ${c.usuarioNome || "outro usuário"} de ${inicioFormatado} até ${fimFormatado}.`
      );
    }

    const payload = {
      notebookId,
      notebookPatrimonio: notebookPatrimonio || "",
      usuarioId,
      usuarioNome: usuarioNome || "Usuário",
      dataInicio,
      dataFim,
      finalidade: finalidade?.trim() || "",
      status: "confirmada", // "confirmada" | "cancelada" | "concluida"
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, "reservas"), payload);
    return { id: docRef.id, ...payload };
  },

  async cancelarReserva(reservaId) {
    await updateDoc(doc(db, "reservas", reservaId), {
      status: "cancelada",
      updatedAt: serverTimestamp()
    });
  },

  listarReservas(callback) {
    const q = query(collection(db, "reservas"));
    return onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      lista.sort((a, b) => new Date(b.dataInicio) - new Date(a.dataInicio));
      callback(lista);
    });
  }
};

// ============================================================================
// 4. ENTIDADE: USO_NOTEBOOKS (Rastreamento de Retiradas e Devoluções)
// Mapeamento: Coleção 'uso_notebooks'
// ============================================================================
export const usoNotebooksService = {
  /**
   * Registra a retirada de um notebook (check-in de uso),
   * atualizando automaticamente o status do notebook para 'em_uso'.
   */
  async registrarRetirada({ notebookId, notebookPatrimonio, usuarioId, usuarioNome, reservaId, observacoesRetirada }) {
    if (!notebookId || !usuarioId) {
      throw new Error("Notebook e usuário são obrigatórios para registrar retirada.");
    }

    const payload = {
      notebookId,
      notebookPatrimonio: notebookPatrimonio || "",
      usuarioId,
      usuarioNome: usuarioNome || "Usuário",
      reservaId: reservaId || null,
      dataRetirada: new Date().toISOString(),
      dataDevolucao: null,
      status: "em_andamento", // "em_andamento" | "devolvido"
      observacoesRetirada: observacoesRetirada?.trim() || "",
      observacoesDevolucao: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const ref = await addDoc(collection(db, "uso_notebooks"), payload);

    // Atualiza status do notebook para 'em_uso'
    await notebooksService.atualizarStatus(notebookId, "em_uso");

    return { id: ref.id, ...payload };
  },

  /**
   * Registra a devolução do notebook (check-out),
   * atualizando o status do notebook de volta para 'disponivel'.
   */
  async registrarDevolucao(usoId, notebookId, observacoesDevolucao) {
    await updateDoc(doc(db, "uso_notebooks", usoId), {
      status: "devolvido",
      dataDevolucao: new Date().toISOString(),
      observacoesDevolucao: observacoesDevolucao?.trim() || "",
      updatedAt: serverTimestamp()
    });

    // Libera o notebook para novo uso
    await notebooksService.atualizarStatus(notebookId, "disponivel");
  },

  listarUso(callback) {
    const q = query(collection(db, "uso_notebooks"));
    return onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      lista.sort((a, b) => new Date(b.dataRetirada) - new Date(a.dataRetirada));
      callback(lista);
    });
  }
};
