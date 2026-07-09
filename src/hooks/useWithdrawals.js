import { useState, useEffect, useCallback } from "react";
import {
  getWithdrawalRequests, getWithdrawalBlock, getAvailableToWithdraw,
  subscribeToWithdrawals, requestWithdrawal, summarizeWithdrawals
} from "../services/walletService";

// Encapsulates everything the Wallet withdrawal UI needs so the page stays thin:
// the user's request history, the server-computed block reason + available
// amount, a live subscription, a derived summary, and the request action.
export function useWithdrawals(userId) {
  const [requests, setRequests] = useState([]);
  const [block, setBlock] = useState(null);       // string reason or null
  const [available, setAvailable] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    const [reqs, blk, avail] = await Promise.all([
      getWithdrawalRequests(userId),
      getWithdrawalBlock(userId),
      getAvailableToWithdraw(userId)
    ]);
    setRequests(reqs.data || []);
    setBlock(blk.reason || null);
    setAvailable(avail.amount || 0);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!userId) return;
    return subscribeToWithdrawals(userId, load);
  }, [userId, load]);

  const submit = useCallback(async (amount, destination) => {
    const res = await requestWithdrawal(amount, destination);
    if (!res.error) await load();
    return res;
  }, [load]);

  const summary = summarizeWithdrawals(requests);

  return { requests, block, available, loading, summary, reload: load, submit };
}
