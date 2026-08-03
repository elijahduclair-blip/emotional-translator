import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Loader2, ChevronDown, ChevronRight, Wrench } from 'lucide-react';

const statusLabel = (status) => {
  switch (status) {
    case 'pending':
    case 'running':
    case 'in_progress':
      return { text: 'working…', spin: true, tone: 'text-amber-700' };
    case 'completed':
    case 'success':
      return { text: 'done', spin: false, tone: 'text-emerald-700' };
    case 'failed':
    case 'error':
      return { text: 'failed', spin: false, tone: 'text-red-600' };
    default:
      return { text: status, spin: false, tone: 'text-black/50' };
  }
};

function FunctionDisplay({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const status = statusLabel(toolCall.status);
  const failed = ['failed', 'error'].includes(toolCall.status);
  const proj = toolCall.display_projection || {};
  const hideDetails = proj.hide_details && proj.details_redacted;

  let parsedArgs = toolCall.arguments_string;
  try { parsedArgs = JSON.parse(toolCall.arguments_string); } catch { /* keep raw */ }

  let parsedResults = toolCall.results;
  if (typeof parsedResults === 'string') {
    try { parsedResults = JSON.parse(parsedResults); } catch { /* keep raw */ }
  }
  const resultFailed = typeof parsedResults === 'object' && parsedResults && parsedResults.success === false;

  const label = proj.label || toolCall.name;
  const activeLabel = proj.active_label || label;
  const errorLabel = proj.error_label || label;

  if (hideDetails) {
    return (
      <div className="mt-2 text-xs flex items-center gap-1.5 opacity-70">
        {status.spin ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wrench className="w-3 h-3" />}
        <span className={failed ? 'text-red-400' : ''}>
          {failed ? errorLabel : status.spin ? activeLabel : label}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-2 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity"
      >
        {status.spin ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wrench className="w-3 h-3" />}
        <span className={failed || resultFailed ? 'text-red-400 font-bold' : 'font-bold'}>{label}</span>
        <span className={failed || resultFailed ? 'text-red-400' : 'opacity-70'}>· {status.text}</span>
        <span className="opacity-50">{expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}</span>
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1.5 pl-5">
          <div>
            <span className="opacity-60 font-bold">Parameters: </span>
            <pre className="inline-block font-mono whitespace-pre-wrap opacity-90">{typeof parsedArgs === 'string' ? parsedArgs : JSON.stringify(parsedArgs, null, 2)}</pre>
          </div>
          <div>
            <span className="opacity-60 font-bold">Result: </span>
            <pre className="inline-block font-mono whitespace-pre-wrap opacity-90">{typeof parsedResults === 'string' ? parsedResults : JSON.stringify(parsedResults, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const toolCalls = message.tool_calls || [];
  const [toolsExpanded, setToolsExpanded] = useState(false);

  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className="max-w-[85%] px-4 py-3"
        style={{
          backgroundColor: isUser ? '#caff70' : '#2d79f7',
          color: isUser ? '#000000' : '#ffffff',
          border: '2px solid #1d1d1d',
          borderRadius: '8px',
          boxShadow: isUser
            ? '-4px 4px 0 0 #00ff8f, -6px 6px 0 0 #1d1d1d'
            : '4px 4px 0 0 #00ff8f, 6px 6px 0 0 #1d1d1d',
        }}
      >
        {message.content && (
          isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : (
            <ReactMarkdown
              className="text-sm max-w-none prose-p:my-1 prose-p:first:mt-0 prose-p:last:mb-0 [&_strong]:font-bold"
              components={{
                strong: ({ node, ...props }) => <strong className="font-bold" {...props} />,
                li: ({ node, ...props }) => <li className="ml-4 list-decimal" {...props} />,
              }}
            >
              {message.content}
            </ReactMarkdown>
          )
        )}
        {toolCalls.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setToolsExpanded(!toolsExpanded)}
              className="flex items-center justify-center gap-1.5 w-full text-xs font-bold px-3 py-1.5"
              style={{ border: '2px solid #1d1d1d', borderRadius: '8px', backgroundColor: '#1d1d1d', color: '#ffffff' }}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${toolsExpanded ? '' : 'rotate-180'}`} />
              {toolsExpanded ? 'Hide' : '↓'} {toolCalls.length} Tool {toolCalls.length === 1 ? 'Call' : 'Calls'}
            </button>
            {toolsExpanded && (
              <div className="mt-2 space-y-1.5">
                {toolCalls.map((tc, idx) => <FunctionDisplay key={idx} toolCall={tc} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}