import type { WalineComment, WalineCommentData } from '../typings';

export interface FetchErrorData {
  errno: number;
  errmsg: string;
}

const JSON_HEADERS: Record<string, string> = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'Content-Type': 'application/json',
};

const errorCheck = <T = unknown>(data: T | FetchErrorData, name = ''): T => {
  if (typeof data === 'object' && (data as FetchErrorData).errno)
    throw new TypeError(
      `Fetch ${name} failed with ${(data as FetchErrorData).errno}: ${(data as FetchErrorData).errmsg
      }`
    );

  return data as T;
};

export interface FetchCountOptions {
  serverURL: string;
  lang: string;
  paths: string[];
  signal: AbortSignal;
  token?: string;
}

export const fetchCommentCount = ({
  serverURL,
  lang,
  paths,
  signal,
  token,
}: FetchCountOptions): Promise<number[]> => {
  const headers: Record<string, string> = {};

  if (token) headers.Authorization = `Bearer ${token}`;

  return (
    fetch(
      `${serverURL}/comment?type=count&url=${encodeURIComponent(
        paths.join(',')
      )}&lang=${lang}`,
      { signal, headers }
    )
      .then((resp) => resp.json() as Promise<number | number[]>)
      .then((data) => errorCheck(data, 'comment count'))
      // TODO: Improve this API
      .then((counts) => (Array.isArray(counts) ? counts : [counts]))
  );
};
export interface FetchRecentOptions {
  serverURL: string;
  lang: string;
  count: number;
  signal: AbortSignal;
  token?: string;
}

export const fetchRecentComment = ({
  serverURL,
  lang,
  count,
  signal,
  token,
}: FetchRecentOptions): Promise<WalineComment[]> => {
  const headers: Record<string, string> = {};

  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(`${serverURL}/comment?type=recent&count=${count}&lang=${lang}`, {
    signal,
    headers,
  })
    .then((resp) => resp.json() as Promise<WalineComment[]>)
    .then((data) => errorCheck(data, 'recent comment'));
};

export interface FetchListOptions {
  serverURL: string;
  path: string;
  page: number;
  pageSize: number;
  sortBy: string;
  signal: AbortSignal;
  token?: string;
  lang: string;
}

export interface FetchListResult {
  count: number;
  data: WalineComment[];
  totalPages: number;
}

export const fetchCommentList = ({
  serverURL,
  lang,
  path,
  page,
  pageSize,
  sortBy,
  signal,
  token,
}: FetchListOptions): Promise<FetchListResult> => {
  const headers: Record<string, string> = {};

  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(
    `${serverURL}/comment?path=${encodeURIComponent(
      path
    )}&pageSize=${pageSize}&page=${page}&lang=${lang}&sortBy=${sortBy}`,
    { signal, headers }
  )
    .then((resp) => resp.json() as Promise<FetchListResult>)
    .then((data) => errorCheck(data, 'comment list'));
};

export interface PostCommentOptions {
  serverURL: string;
  lang: string;
  token?: string;
  comment: WalineCommentData;
}

export interface PostCommentResponse {
  data?: WalineComment;
  errmsg?: string;
}

export const postComment = ({
  serverURL,
  lang,
  token,
  comment,
}: PostCommentOptions): Promise<PostCommentResponse> => {
  const headers: Record<string, string> = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'Content-Type': 'application/json',
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  if (comment.eid) {
    return fetch(`${serverURL}/comment/${comment.eid}?lang=${lang}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(comment),
    }).then((resp) => resp.json() as Promise<PostCommentResponse>);
  }

  return fetch(`${serverURL}/comment?lang=${lang}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(comment),
  }).then((resp) => resp.json() as Promise<PostCommentResponse>);
};

export interface DeleteCommentOptions {
  serverURL: string;
  lang: string;
  token: string;
  objectId: string | number;
}

export const deleteComment = ({
  serverURL,
  lang,
  token,
  objectId,
}: DeleteCommentOptions): Promise<void> => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  return fetch(`${serverURL}/comment/${objectId}?lang=${lang}`, {
    method: 'DELETE',
    headers,
  }).then((resp) => resp.json() as Promise<void>);
};

export interface LikeCommentOptions {
  serverURL: string;
  lang: string;
  objectId: number | string;
  like: boolean;
}

export const likeComment = ({
  serverURL,
  lang,
  objectId,
  like,
}: LikeCommentOptions): Promise<void> =>
  fetch(`${serverURL}/comment/${objectId}?lang=${lang}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ like }),
  }).then((resp) => resp.json() as Promise<void>);

export interface UpdateCommentOptions {
  serverURL: string;
  lang: string;
  token: string;
  objectId: number | string;
  status?: 'approved' | 'waiting' | 'spam';
  sticky?: number;
}

export const updateComment = ({
  serverURL,
  lang,
  token,
  objectId,
  ...data
}: UpdateCommentOptions): Promise<void> => {
  const headers: Record<string, string> = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  return fetch(`${serverURL}/comment/${objectId}?lang=${lang}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  }).then((resp) => resp.json() as Promise<void>);
};

export interface FetchArticleCounterOptions {
  serverURL: string;
  lang: string;
  paths: string[];
  type: string[];
  signal: AbortSignal;
}

export const fetchArticleCounter = ({
  serverURL,
  lang,
  paths,
  type,
  signal,
}: FetchArticleCounterOptions): Promise<
  Record<string, number>[] | Record<string, number> | number[] | number
> =>
  fetch(
    `${serverURL}/article?path=${encodeURIComponent(
      paths.join(',')
    )}&type=${encodeURIComponent(type.join(','))}&lang=${lang}`,
    { signal }
  )
    .then(
      (resp) =>
        resp.json() as Promise<Record<string, number>[] | number[] | number>
    )
    .then((data) => errorCheck(data, 'article count'));

export const fetchPageviews = ({
  serverURL,
  lang,
  paths,
  signal,
}: Omit<FetchArticleCounterOptions, 'type'>): Promise<number[] | number> =>
  fetchArticleCounter({
    serverURL,
    lang,
    paths,
    type: ['time'],
    signal,
  })
    // TODO: Improve this API
    .then((counts) => (Array.isArray(counts) ? counts : [counts])) as Promise<
    number[] | number
  >;

export interface UpdateArticleCounterOptions {
  serverURL: string;
  lang: string;
  path: string;
  type: string;
  action?: 'inc' | 'desc';
}

export const updateArticleCounter = ({
  serverURL,
  lang,
  path,
  type,
  action,
}: UpdateArticleCounterOptions): Promise<number> =>
  fetch(`${serverURL}/article?lang=${lang}`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ path, type, action }),
  })
    .then((resp) => resp.json() as Promise<number>)
    .then((data) => errorCheck(data, 'article count'));

export const updatePageviews = (
  options: Omit<UpdateArticleCounterOptions, 'type'>
): Promise<number> =>
  updateArticleCounter({
    ...options,
    type: 'time',
  });
