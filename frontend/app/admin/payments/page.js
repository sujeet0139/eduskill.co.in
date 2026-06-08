"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { StatusBadge, Button, Input } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td, Modal } from "@/components/admin";

const fileHref = (p) => (!p ? null : /^https?:\/\//.test(p) ? p : `${api.base}${p}`);

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [manual, setManual] = useState({ studentId: "", amount: "1000", referenceNo: "", paymentDate: "" });
  const token = () => adminAuth.token();

  const load = () => {
    setLoading(true);
    api.get("/api/payments/all", token())
      .then((d) => setPayments(d.payments || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const approve = async (p) => {
    try { await api.post("/api/payments/approve", { paymentId: p.id, studentId: p.student_id }, token()); load(); }
    catch (e) { alert(e.message); }
  };
  const refund = async (p) => {
    if (!confirm("Mark this payment as failed/refunded?")) return;
    try { await api.put(`/api/payments/${p.id}/refund`, {}, token()); load(); }
    catch (e) { alert(e.message); }
  };
  const addManual = async (e) => {
    e.preventDefault();
    try {
      await api.post("/api/payments/manual", manual, token());
      setModal(false);
      setManual({ studentId: "", amount: "1000", referenceNo: "", paymentDate: "" });
      load();
    } catch (err) { alert(err.message); }
  };

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle={`${payments.length} records`}
        action={<Button onClick={() => setModal(true)}>+ Manual Payment</Button>}
      />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <TableWrap>
        <thead className="bg-gray-50">
          <tr><Th>Student</Th><Th>Ref</Th><Th>Amount</Th><Th>Txn ID</Th><Th>Proof</Th><Th>Status</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y">
          {loading ? (
            <tr><Td className="text-gray-500">Loading…</Td></tr>
          ) : payments.length === 0 ? (
            <tr><Td className="text-gray-500">No payments yet.</Td></tr>
          ) : payments.map((p) => (
            <tr key={p.id} className="hover:bg-gray-50">
              <Td className="font-medium">{p.name}<div className="text-xs text-gray-500">{p.email}</div></Td>
              <Td className="font-mono text-xs">{p.reference_no}</Td>
              <Td>₹{p.amount}</Td>
              <Td className="text-xs">{p.transaction_id || "—"}</Td>
              <Td>{p.screenshot ? <a href={fileHref(p.screenshot)} target="_blank" rel="noreferrer" className="text-brand hover:underline">View</a> : "—"}</Td>
              <Td><StatusBadge status={p.status} /></Td>
              <Td>
                <div className="flex gap-2">
                  {p.status !== "completed" && (
                    <button onClick={() => approve(p)} className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700">Approve</button>
                  )}
                  {p.status !== "failed" && (
                    <button onClick={() => refund(p)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">Refund</button>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <Modal open={modal} title="Add Manual Payment" onClose={() => setModal(false)}>
        <form onSubmit={addManual} className="space-y-3">
          <Input label="Student ID *" value={manual.studentId} onChange={(e) => setManual({ ...manual, studentId: e.target.value })} required />
          <Input label="Amount (₹)" type="number" value={manual.amount} onChange={(e) => setManual({ ...manual, amount: e.target.value })} />
          <Input label="Reference / Mode" value={manual.referenceNo} onChange={(e) => setManual({ ...manual, referenceNo: e.target.value })} />
          <Input label="Payment Date" type="date" value={manual.paymentDate} onChange={(e) => setManual({ ...manual, paymentDate: e.target.value })} />
          <Button type="submit" className="w-full">Save Payment</Button>
        </form>
      </Modal>
    </>
  );
}
